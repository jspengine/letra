import type { Item, Workflow } from "../commands/flow-init.js";
import type { AgenticExecutor } from "../executor/executor.js";
import type { ExecutionContext, ExecutionResult } from "../harness/types.js";

export interface DispatcherStore {
	loadWorkflow(): Workflow;
	writeWorkflow(workflow: Workflow): Promise<void> | void;
	advance(itemId: string, stage: string): Promise<void> | void;
	/** Optional durable CAS claim. Returning false means another worker won. */
	claim?(itemId: string, executorId: string, agentId: string): Promise<boolean> | boolean;
}

export interface DispatcherResult { itemId: string; status: "dispatched" | "waiting-human" | "offline" | "failed"; reason?: string; }

export interface DispatcherOptions {
	/** Human gates are the only gates that stop an autonomous handoff. */
	blocksHandoff?: (stage: Workflow["stages"][number], item: Item) => boolean;
	/** Resolve actors from the harness when workflow instances omit them. */
	stageActors?: (stageId: string) => string[];
	onResult?: (result: DispatcherResult) => void;
}

/** Durable polling coordinator: one item is claimed before an executor starts. */
export class PersistentDispatcher {
	private timer: ReturnType<typeof setInterval> | undefined;
	private running = false;
	constructor(
		private readonly store: DispatcherStore,
		private readonly executors: () => AgenticExecutor[],
		private readonly intervalMs = 30_000,
		private readonly options: DispatcherOptions = {},
	) {}
	start(): void { if (this.timer) return; void this.dispatch(); this.timer = setInterval(() => void this.dispatch(), this.intervalMs); }
	stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
	async dispatch(): Promise<DispatcherResult[]> {
		if (this.running) return [];
		this.running = true;
		try {
			const workflow = this.store.loadWorkflow();
			const results: DispatcherResult[] = [];
			for (const item of workflow.items) {
				if (!item.handoff || item.claimedBy) continue;
				const stage = workflow.stages.find((entry) => entry.id === item.stage);
				if (!stage) continue;
				if (item.handoff.to === "human" || item.handoff.to.startsWith("human:")) {
					const result = { itemId: item.id, status: "waiting-human" as const, reason: "aguardando decisão humana" };
					results.push(result); this.options.onResult?.(result); continue;
				}
				if (this.options.blocksHandoff?.(stage, item)) {
					const result = { itemId: item.id, status: "waiting-human" as const, reason: "gate humano bloqueante" };
					results.push(result); this.options.onResult?.(result); continue;
				}
				const capability = stage.id;
				const online = this.executors().filter((entry) => entry.status !== "offline");
				const executor = online.find((entry) => entry.capabilities.includes(capability)) ?? online[0];
				if (!executor) { results.push({ itemId: item.id, status: "offline", reason: "nenhum executor online" }); continue; }
				const claimed: Item = {
					...item,
					claimedBy: item.handoff.to,
					claimedAt: new Date().toISOString(),
					claimExecutorId: executor.id,
					activityStatus: "started",
					activityStartedAt: new Date().toISOString(),
					lastHeartbeatAt: new Date().toISOString(),
				};
				if (this.store.claim) {
					const accepted = await this.store.claim(item.id, executor.id, item.handoff.to);
					if (!accepted) continue;
				} else {
					const nextWorkflow = { ...workflow, items: workflow.items.map((entry) => entry.id === item.id ? claimed : entry) };
					await this.store.writeWorkflow(nextWorkflow);
				}
				try {
					if (typeof (executor as AgenticExecutor & { heartbeat?: () => Promise<void> }).heartbeat === "function") {
						await (executor as AgenticExecutor & { heartbeat: () => Promise<void> }).heartbeat();
					}
					const execution = await executor.execute({ itemId: claimed.id, item: claimed, agent: item.handoff.to, stage: item.stage, spec: claimed.spec ?? null, diff: null, snapshot: { stages: workflow.stages.map((entry) => ({ ...entry, agents: this.options.stageActors?.(entry.id) ?? (entry as typeof entry & { agents?: string[] }).agents })) }, sessionLog: [], commands: [], prohibitions: [] } satisfies ExecutionContext);
					const current = this.store.loadWorkflow();
					const updated = current.items.map((entry) => {
						if (entry.id !== item.id) return entry;
						const next: Item = { ...entry, claimedBy: undefined, claimedAt: undefined, claimExecutorId: undefined, activityStatus: execution.success ? "succeeded" : "failed", lastHeartbeatAt: new Date().toISOString() };
						if (execution.success && execution.handoff) {
							const targetStage = workflow.stages.find((candidate) =>
								(this.options.stageActors?.(candidate.id) ?? (candidate as typeof candidate & { agents?: string[] }).agents ?? []).includes(execution.handoff!.to),
							);
							if (targetStage) next.stage = targetStage.id;
							next.handoff = {
								from: execution.handoff.from,
								to: execution.handoff.to,
								summary: execution.handoff.summary,
								evidence: execution.handoff.evidence ?? execution.evidences ?? [],
								timestamp: execution.handoff.timestamp,
								expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
								executorId: executor.id,
							};
						}
						if (!execution.success) next.lastFailure = { code: "EXECUTOR_FAILED", message: execution.error ?? execution.output, recovery: "retry", at: new Date().toISOString() };
						return next;
					});
					await this.store.writeWorkflow({ ...current, items: updated, updatedAt: new Date().toISOString() });
					const result = execution.success ? { itemId: item.id, status: "dispatched" as const } : { itemId: item.id, status: "failed" as const, reason: execution.error ?? execution.output };
					results.push(result); this.options.onResult?.(result);
				} catch (error) {
					const current = this.store.loadWorkflow();
					const message = error instanceof Error ? error.message : String(error);
					const recoveredItems = current.items.map((entry) => entry.id === item.id
						? { ...entry, claimedBy: undefined, claimedAt: undefined, claimExecutorId: undefined, activityStatus: "failed" as const, lastFailure: { code: "EXECUTOR_EXCEPTION", message, recovery: "retry", at: new Date().toISOString() } }
						: entry);
					await this.store.writeWorkflow({ ...current, items: recoveredItems, updatedAt: new Date().toISOString() });
					const result = { itemId: item.id, status: "failed" as const, reason: error instanceof Error ? error.message : String(error) };
					results.push(result); this.options.onResult?.(result);
				}
			}
			return results;
		} finally { this.running = false; }
	}
}
