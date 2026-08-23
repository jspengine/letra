import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Item, Workflow } from "../commands/flow-init.js";
import type { HandoffPayload, ExecutorConfig, HeartbeatInfo, HarnessManifest } from "../harness/types.js";
import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import { logEntry } from "../session-log.js";
import { GateChecker } from "../harness/gate-checker.js";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { loadHarness, resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "../harness/loader.js";

const DEFAULT_HEARTBEAT_INTERVAL = 30_000;
const DEFAULT_HEARTBEAT_TIMEOUT = 60_000;
const DEFAULT_MAX_EXECUTION_TIME = 1_800_000;
const RECLAIM_INTERVAL = 60_000;

export interface OrchestratorConfig {
	root: string;
	heartbeatInterval?: number;
	heartbeatTimeout?: number;
	maxExecutionTime?: number;
	reclaimInterval?: number;
}

export class Orchestrator {
	private readonly root: string;
	private readonly gateChecker: GateChecker;
	private readonly manifest: HarnessManifest | null;
	private readonly executors: Map<string, ExecutorConfig> = new Map();
	private readonly heartbeats: Map<string, HeartbeatInfo> = new Map();
	private readonly claimLocks: Map<string, { executor: string; claimedAt: number }> = new Map();
	private readonly stageExecutorPreferences: Map<string, string[]> = new Map();
	private reclaimTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config: OrchestratorConfig) {
		this.root = config.root;
		this.manifest = loadHarness(resolveHarnessRoot(config.root, DEFAULT_HARNESS_VERSION));
		this.gateChecker = new GateChecker(config.root, this.manifest ?? undefined);
	}

	registerExecutor(executor: ExecutorConfig): void {
		this.executors.set(executor.id, executor);
		this.heartbeats.set(executor.id, {
			executorId: executor.id,
			lastHeartbeat: new Date().toISOString(),
			isOnline: true,
		});
	}

	registerFromManifest(): void {
		if (!this.manifest?.executors) return;
		for (const entry of this.manifest.executors.executors) {
			this.registerExecutor({
				id: entry.id,
				label: entry.label,
				capabilities: entry.capabilities,
				notification: entry.notification,
				heartbeat: entry.heartbeat,
				maxExecutionTime: entry.maxExecutionTime,
				priority: entry.priority,
			});
		}
		for (const [stageId, prefs] of Object.entries(this.manifest.executors.stageExecutorPreferences)) {
			this.stageExecutorPreferences.set(stageId, prefs);
		}
	}

	getManifest(): HarnessManifest | null {
		return this.manifest;
	}

	detectPendingHandoff(agentId: string): { item: Item; handoff: HandoffPayload } | null {
		const workflow = loadWorkflow(this.root);
		if (!workflow) return null;

		for (const item of workflow.items) {
			if (item.handoff && item.handoff.to === agentId) {
				if (new Date(item.handoff.expiresAt) < new Date()) {
					continue;
				}
				return {
					item,
					handoff: {
						itemId: item.id,
						from: item.handoff.from,
						to: item.handoff.to,
						summary: item.handoff.summary,
						evidence: item.handoff.evidence,
						timestamp: item.handoff.timestamp,
						expiresAt: item.handoff.expiresAt,
						executorId: item.handoff.executorId,
					},
				};
			}
		}
		return null;
	}

	emitHandoff(payload: HandoffPayload): { success: boolean; reason?: string } {
		const workflow = loadWorkflow(this.root);
		if (!workflow) {
			return { success: false, reason: "No workflow found" };
		}

		const item = workflow.items.find((i) => i.id === payload.itemId);
		if (!item) {
			return { success: false, reason: `Item ${payload.itemId} not found` };
		}

		const stage = workflow.stages.find((s) => s.id === item.stage);
		if (!stage) {
			return { success: false, reason: `Stage ${item.stage} not found` };
		}

		const currentStage = workflow.stages.find((s) => s.id === item.stage);
		if (currentStage?.gate) {
			const gateResult = this.gateChecker.checkHandoffAllowed(currentStage.gate, item);
			if (!gateResult.allowed) {
				return { success: false, reason: gateResult.reason };
			}
		}

		item.handoff = {
			from: payload.from,
			to: payload.to,
			summary: payload.summary,
			evidence: payload.evidence,
			timestamp: payload.timestamp,
			expiresAt: payload.expiresAt,
			executorId: payload.executorId,
		};

		workflow.updatedAt = new Date().toISOString();
		writeWorkflow(this.root, { workflow, source: "orchestrator", primaryItemId: item.id, skipSitrep: true });

		this.writeHandoffFile(item);

		logEntry(this.root, "handoff_emitted", `Handoff emitted to ${payload.to}`, {
			itemId: payload.itemId,
			from: payload.from,
			to: payload.to,
			summary: payload.summary,
			evidence: payload.evidence,
		});

		return { success: true };
	}

	autoClaim(
		itemId: string,
		executorId: string,
		agentId: string,
	): { success: boolean; reason?: string } {
		const workflow = loadWorkflow(this.root);
		if (!workflow) {
			return { success: false, reason: "No workflow found" };
		}

		const item = workflow.items.find((i) => i.id === itemId);
		if (!item) {
			return { success: false, reason: `Item ${itemId} not found` };
		}

		const lock = this.claimLocks.get(itemId);
		if (lock && lock.executor !== executorId) {
			const lockOwnerConfig = this.executors.get(lock.executor);
			const lockMaxExecTime = lockOwnerConfig?.maxExecutionTime
				? lockOwnerConfig.maxExecutionTime * 1000
				: DEFAULT_MAX_EXECUTION_TIME;
			const lockAge = Date.now() - lock.claimedAt;
			if (lockAge < lockMaxExecTime) {
				return { success: false, reason: `Item already claimed by ${lock.executor}` };
			}
		}

		if (item.handoff && item.handoff.to !== agentId) {
			return { success: false, reason: `Item handoff is for ${item.handoff.to}, not ${agentId}` };
		}

		this.claimLocks.set(itemId, {
			executor: executorId,
			claimedAt: Date.now(),
		});

		item.claimedBy = executorId;
		item.claimedAt = new Date().toISOString();

		if (item.handoff && item.handoff.to === agentId) {
			delete item.handoff;
			this.removeHandoffFile(itemId);
		}

		workflow.updatedAt = new Date().toISOString();
		writeWorkflow(this.root, { workflow, source: "orchestrator", primaryItemId: itemId, skipSitrep: true });

		logEntry(this.root, "item_claim", `Claimed by ${executorId}`, {
			itemId,
			executorId,
			agentId,
		});

		return { success: true };
	}

	buildContext(itemId: string, agentId: string): Record<string, unknown> | null {
		const workflow = loadWorkflow(this.root);
		if (!workflow) return null;

		const item = workflow.items.find((i) => i.id === itemId);
		if (!item) return null;

		const snapshot = resolveAgentDirection(this.root);
		let specContent: string | null = null;
		if (item.spec) {
			const specPath = join(this.root, ".letra", "specs", item.spec, "spec.md");
			if (existsSync(specPath)) {
				specContent = readFileSync(specPath, "utf-8");
			}
		}

		let promptTemplate: string | null = null;
		if (this.manifest) {
			const stage = workflow.stages.find((s) => s.id === item.stage);
			if (stage) {
				for (const flowId of Object.keys(this.manifest.flows)) {
					const flow = this.manifest.flows[flowId];
					const flowStage = flow.stages.find((s) => s.id === stage.id);
					if (flowStage) {
						for (const roleId of flowStage.agents) {
							const role = this.manifest.roles[roleId];
							if (role?.promptTemplate) {
								promptTemplate = role.promptTemplate;
								break;
							}
						}
						break;
					}
				}
			}
		}

		return {
			itemId: item.id,
			item,
			agent: agentId,
			stage: item.stage,
			spec: specContent,
			snapshot,
			promptTemplate,
			commands: snapshot?.commands?.map((c) => c.command) || [],
			prohibitions: snapshot?.prohibitions || [],
		};
	}

	heartbeat(executorId: string): void {
		this.heartbeats.set(executorId, {
			executorId,
			lastHeartbeat: new Date().toISOString(),
			isOnline: true,
		});
	}

	reclaimStaleItems(): string[] {
		const workflow = loadWorkflow(this.root);
		if (!workflow) return [];

		const reclaimed: string[] = [];
		const now = Date.now();

		for (const [itemId, lock] of this.claimLocks) {
			const executorConfig = this.executors.get(lock.executor);
			const maxExecTime = executorConfig?.maxExecutionTime
				? executorConfig.maxExecutionTime * 1000
				: DEFAULT_MAX_EXECUTION_TIME;
			const age = now - lock.claimedAt;
			if (age > maxExecTime) {
				const item = workflow.items.find((i) => i.id === itemId);
				if (item) {
					delete item.claimedBy;
					delete item.claimedAt;
					reclaimed.push(itemId);

					logEntry(this.root, "item_reclaim", `Item reclaimed (timeout ${age}ms)`, {
						itemId,
						executorId: lock.executor,
					});
				}
				this.claimLocks.delete(itemId);
			}
		}

		for (const [executorId, heartbeat] of this.heartbeats) {
			const executor = this.executors.get(executorId);
			if (executor?.heartbeat) {
				const lastBeat = new Date(heartbeat.lastHeartbeat).getTime();
				const beatAge = now - lastBeat;
				if (beatAge > DEFAULT_HEARTBEAT_TIMEOUT) {
					this.heartbeats.set(executorId, {
						...heartbeat,
						isOnline: false,
					});
				}
			}
		}

		if (reclaimed.length > 0) {
			workflow.updatedAt = new Date().toISOString();
			writeWorkflow(this.root, { workflow, source: "orchestrator-reclaim", skipSitrep: true });
		}

		return reclaimed;
	}

	startReclaimTimer(): void {
		if (this.reclaimTimer) return;
		this.reclaimTimer = setInterval(() => {
			this.reclaimStaleItems();
		}, RECLAIM_INTERVAL);
	}

	stopReclaimTimer(): void {
		if (this.reclaimTimer) {
			clearInterval(this.reclaimTimer);
			this.reclaimTimer = null;
		}
	}

	getExecutorStatus(executorId: string): HeartbeatInfo | undefined {
		return this.heartbeats.get(executorId);
	}

	getAllExecutorStatuses(): HeartbeatInfo[] {
		return Array.from(this.heartbeats.values());
	}

	private getHandoffsDir(): string {
		return join(this.root, ".letra", "handoffs");
	}

	private writeHandoffFile(item: Item): void {
		if (!item.handoff) return;
		const dir = this.getHandoffsDir();
		mkdirSync(dir, { recursive: true });
		const filePath = join(dir, `${item.id}.json`);
		writeFileSync(filePath, JSON.stringify({
			itemId: item.id,
			from: item.handoff.from,
			to: item.handoff.to,
			summary: item.handoff.summary,
			evidence: item.handoff.evidence,
			timestamp: item.handoff.timestamp,
			expiresAt: item.handoff.expiresAt,
			executorId: item.handoff.executorId,
		}, null, 2));
	}

	private removeHandoffFile(itemId: string): void {
		const filePath = join(this.getHandoffsDir(), `${itemId}.json`);
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}
	}

	retryHandoff(itemId: string): { success: boolean; reason?: string; reEmittedTo?: string } {
		const workflow = loadWorkflow(this.root);
		if (!workflow) {
			return { success: false, reason: "No workflow found" };
		}

		const item = workflow.items.find((i) => i.id === itemId);
		if (!item) {
			return { success: false, reason: `Item ${itemId} not found` };
		}

		if (!item.handoff) {
			return { success: false, reason: `Item ${itemId} has no pending handoff` };
		}

		if (new Date(item.handoff.expiresAt) >= new Date()) {
			return { success: false, reason: `Handoff for ${itemId} has not expired yet` };
		}

		const previousTo = item.handoff.to;
		const previousFrom = item.handoff.from;
		const summary = item.handoff.summary;
		const evidence = item.handoff.evidence;

		const manifest = this.manifest ?? loadHarness(resolveHarnessRoot(this.root, DEFAULT_HARNESS_VERSION));
		if (!manifest?.executors) {
			return { success: false, reason: "No executor registry available for retry" };
		}

		const registry = manifest.executors;
		const currentExecutor = item.handoff.executorId;

		const candidates = registry.executors
			.filter((e) => e.id !== currentExecutor)
			.sort((a, b) => a.priority - b.priority);

		const nextExecutor = candidates.find((e) => {
			const hb = this.heartbeats.get(e.id);
			return !hb || hb.isOnline;
		});

		if (!nextExecutor) {
			return { success: false, reason: "No other executor available for retry" };
		}

		const ttlMinutes = 30;
		const now = new Date();
		const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

		item.handoff = {
			from: previousFrom,
			to: previousTo,
			summary,
			evidence,
			timestamp: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			executorId: nextExecutor.id,
		};

		workflow.updatedAt = now.toISOString();
		writeWorkflow(this.root, { workflow, source: "orchestrator-retry", primaryItemId: itemId, skipSitrep: true });

		this.writeHandoffFile(item);

		logEntry(this.root, "handoff_emitted", `Handoff re-emitted to ${previousTo} (retry via ${nextExecutor.id})`, {
			itemId,
			from: previousFrom,
			to: previousTo,
			executorId: nextExecutor.id,
			retry: true,
		});

		return { success: true, reEmittedTo: nextExecutor.id };
	}

	getPendingHandoffFiles(): { itemId: string; to: string; expiresAt: string }[] {
		const dir = this.getHandoffsDir();
		if (!existsSync(dir)) return [];
		const { readdirSync } = require("node:fs");
		const files: string[] = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
		const now = new Date();
		return files.flatMap((file: string) => {
			try {
				const data = JSON.parse(readFileSync(join(dir, file), "utf-8"));
				if (new Date(data.expiresAt) < now) return [];
				return [{ itemId: data.itemId, to: data.to, expiresAt: data.expiresAt }];
			} catch {
				return [];
			}
		});
	}
}
