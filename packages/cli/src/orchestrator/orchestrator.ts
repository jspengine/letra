import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Item, Workflow } from "../commands/flow-init.js";
import type { HandoffPayload, ExecutorConfig, HeartbeatInfo } from "../harness/types.js";
import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import { logEntry } from "../session-log.js";
import { GateChecker } from "../harness/gate-checker.js";
import { resolveAgentDirection } from "../agent-direction/service.js";

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
	private readonly executors: Map<string, ExecutorConfig> = new Map();
	private readonly heartbeats: Map<string, HeartbeatInfo> = new Map();
	private readonly claimLocks: Map<string, { executor: string; claimedAt: number }> = new Map();
	private reclaimTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config: OrchestratorConfig) {
		this.root = config.root;
		this.gateChecker = new GateChecker(config.root);
	}

	registerExecutor(executor: ExecutorConfig): void {
		this.executors.set(executor.id, executor);
		this.heartbeats.set(executor.id, {
			executorId: executor.id,
			lastHeartbeat: new Date().toISOString(),
			isOnline: true,
		});
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
			const lockAge = Date.now() - lock.claimedAt;
			if (lockAge < DEFAULT_MAX_EXECUTION_TIME) {
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

		return {
			itemId: item.id,
			item,
			agent: agentId,
			stage: item.stage,
			spec: specContent,
			snapshot,
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
			const age = now - lock.claimedAt;
			if (age > DEFAULT_MAX_EXECUTION_TIME) {
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
}
