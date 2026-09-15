import type { Item, Workflow } from "../commands/flow-init.js";
import type { AgenticExecutor } from "../executor/executor.js";
import type { ExecutionContext, ExecutionResult } from "../harness/types.js";
import type { AgentDirectionSnapshot } from "@letra/types";
import type { RuntimeBindingResolution } from "../agents/runtime-binding.js";
import type { ExecutionWorkspaceResolution } from "./execution-workspace.js";
import type { SecurityReviewReport } from "../security/scoped-review.js";

export interface DispatcherOperationResult {
	outcome: "accepted" | "rejected" | "approval-required";
	afterRevision: string;
	reasonCode: string;
	reason: string;
	nextDirection: AgentDirectionSnapshot;
	securityReview?: SecurityReviewReport;
	evidence?: string[];
}

export interface DispatcherOperations {
	getDirection(itemId: string): AgentDirectionSnapshot;
	claim(input: { itemId: string; executorId: string; capability: string; actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	event(input: { itemId: string; executorId: string; actor: string; status: "started" | "heartbeat" | "succeeded" | "failed"; expectedRevision: string; reason: string; message?: string; errorCode?: string; recovery?: "retry" | "release" | "handoff" | "human"; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	evidence(input: { itemId: string; executorId: string; actor: string; expectedRevision: string; reason: string; evidence: Array<{ kind: "diff" | "file" | "command" | "test" | "artifact"; value: string; source: string }>; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	validate(input: { actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	securityReview?(input: { itemId: string; executorId: string; actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	transition(input: { itemId: string; targetStageId: string; actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	handoff(input: { itemId: string; to: string; executorId: string; actor: string; summary: string; evidence: string[]; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	release(input: { itemId: string; actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
	reclaimExpired?(input: { actor: string; expectedRevision: string; reason: string; idempotencyKey?: string }): Promise<DispatcherOperationResult>;
}

export interface DispatcherStore {
	loadWorkflow(): Workflow;
	operations: DispatcherOperations;
}

export interface DispatcherResult {
	itemId: string;
	status: "dispatched" | "waiting-human" | "offline" | "failed";
	reason?: string;
	/** Canonical operation envelope, when a gateway operation produced one. */
	outcome?: DispatcherOperationResult["outcome"];
	reasonCode?: string;
	securityReview?: SecurityReviewReport;
}

class SecurityReviewOperationError extends Error {
	constructor(readonly operation: DispatcherOperationResult) {
		super(operation.reason);
		this.name = "SecurityReviewOperationError";
	}
}

function evidenceKind(value: string): "file" | "command" {
	const trimmed = value.trim();
	// ExecutionResult currently carries string evidence. Treat path-shaped
	// values as files and symbolic executor output as command evidence so the
	// workspace path confinement check is not applied to labels such as
	// "simulated:code:ITEM-86".
	const absolute = /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("\\");
	const traversal = /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(trimmed);
	return absolute || traversal || (trimmed.includes("/") && !/\s/.test(trimmed))
		? "file"
		: "command";
}

export interface DispatcherOptions {
	/** Human gates are the only gates that stop an autonomous handoff. */
	blocksHandoff?: (stage: Workflow["stages"][number], item: Item) => boolean;
	/** Resolve actors from the harness when workflow instances omit them. */
	stageActors?: (stageId: string) => string[];
	stageCapability?: (stage: Workflow["stages"][number], item: Item) => string;
	executorPreference?: (stage: Workflow["stages"][number], item: Item) => string[];
	/** Resolve and verify the code location before a durable claim is created. */
	resolveExecutionWorkspace?: (stage: Workflow["stages"][number], item: Item) => ExecutionWorkspaceResolution;
	/** The runtime contract is authoritative when configured. */
	resolveBinding?: (stage: Workflow["stages"][number], item: Item, actor: string, capability: string, executors: AgenticExecutor[]) => RuntimeBindingResolution;
	onResult?: (result: DispatcherResult) => void;
}

/**
 * Workflow writes also append an audit entry, so a background watcher can
 * advance the direction between two consecutive gateway calls. Retry only
 * that optimistic-concurrency failure with a freshly observed revision.
 */
async function withFreshRevision(
	getDirection: (itemId: string) => AgentDirectionSnapshot,
	itemId: string,
	operation: (expectedRevision: string) => Promise<DispatcherOperationResult>,
): Promise<DispatcherOperationResult> {
	let expectedRevision = getDirection(itemId).revision;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const result = await operation(expectedRevision);
		if (result.reasonCode !== "DIRECTION_STALE") return result;
		expectedRevision = getDirection(itemId).revision;
	}
	return operation(expectedRevision);
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
			if (this.store.operations.reclaimExpired) {
				const recovery = await withFreshRevision(this.store.operations.getDirection, workflow.primaryItemId ?? "", (expectedRevision) =>
					this.store.operations.reclaimExpired!({ actor: "system:dispatcher", expectedRevision, reason: "Recuperar claims expirados ao iniciar ciclo do dispatcher.", idempotencyKey: `reclaim:${new Date().toISOString().slice(0, 16)}` }),
				);
				if (recovery.outcome !== "accepted" && recovery.reasonCode !== "ITEM_NOT_CURRENT") {
					this.options.onResult?.({ itemId: workflow.primaryItemId ?? "workspace", status: "failed", reason: recovery.reason });
				}
			}
			for (const item of workflow.items) {
				if (!item.handoff || item.claimedBy) continue;
				const stage = workflow.stages.find((entry) => entry.id === item.stage);
				if (!stage) continue;
				const targetsHuman = item.handoff.to === "human" || item.handoff.to.startsWith("human:");
				const blockedByHumanGate = this.options.blocksHandoff?.(stage, item) === true;
				if (blockedByHumanGate) {
					const result = { itemId: item.id, status: "waiting-human" as const, reason: "gate humano bloqueante" };
					results.push(result); this.options.onResult?.(result); continue;
				}
				if (targetsHuman) {
					const result = {
						itemId: item.id,
						status: "failed" as const,
						reason: "HUMAN_HANDOFF_REQUIRES_BLOCKING_GATE: handoff humano sem gate humano bloqueante",
					};
					results.push(result); this.options.onResult?.(result); continue;
				}
				const executionWorkspace = this.options.resolveExecutionWorkspace?.(stage, item);
				if (executionWorkspace && !executionWorkspace.ok) {
					const result = { itemId: item.id, status: "failed" as const, reason: `${executionWorkspace.reasonCode}: ${executionWorkspace.reason}` };
					results.push(result); this.options.onResult?.(result); continue;
				}
				const capability = this.options.stageCapability?.(stage, item) ?? stage.id;
				const actor = item.handoff.to;
				const operationKey = `dispatch:${item.id}:${item.handoff.timestamp}`;
				const allExecutors = this.executors();
				const resolvedBinding = this.options.resolveBinding?.(stage, item, actor, capability, allExecutors);
				const online = allExecutors.filter((entry) => entry.status !== "offline");
				const compatible = online.filter((entry) => entry.capabilities.includes(capability));
				const preference = this.options.executorPreference?.(stage, item) ?? [];
				const executor = resolvedBinding
					? (resolvedBinding.ok ? resolvedBinding.executor : undefined)
					: compatible.sort((a, b) => {
						const ai = preference.indexOf(a.id); const bi = preference.indexOf(b.id);
						if (ai >= 0 || bi >= 0) return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
						return a.id.localeCompare(b.id);
					})[0];
				if (!executor) {
					const result = {
						itemId: item.id,
						status: "offline" as const,
						reason: `${resolvedBinding?.reasonCode ?? "NO_COMPATIBLE_EXECUTOR"}: ${resolvedBinding?.reason ?? "nenhum executor registrado é compatível"}`,
					};
					results.push(result);
					this.options.onResult?.(result);
					continue;
				}
				const claim = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) =>
					this.store.operations.claim({ itemId: item.id, executorId: executor.id, capability, actor, expectedRevision, reason: "Dispatcher autônomo iniciou a execução.", idempotencyKey: `${operationKey}:claim` }),
				);
				if (claim.outcome !== "accepted") {
					const result = { itemId: item.id, status: "failed" as const, reason: claim.reason };
					results.push(result); this.options.onResult?.(result); continue;
				}
				const started = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) =>
					this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "started", expectedRevision, reason: "Registrar início da execução autônoma.", idempotencyKey: `${operationKey}:started` }),
				);
				if (started.outcome !== "accepted") {
					const released = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) =>
						this.store.operations.release({ itemId: item.id, actor, expectedRevision, reason: "Liberar claim após falha ao registrar início.", idempotencyKey: `${operationKey}:release-start` }),
					);
					const result = { itemId: item.id, status: "failed" as const, reason: started.reason };
					results.push(result); this.options.onResult?.(result);
					if (released.outcome !== "accepted") this.options.onResult?.({ ...result, reason: `${result.reason}; liberação do claim: ${released.reason}` });
					continue;
				}
				const claimed: Item = (started.nextDirection.item as Item | null) ?? { ...item, claimedBy: actor, claimExecutorId: executor.id };
				try {
					if (typeof (executor as AgenticExecutor & { heartbeat?: () => Promise<void> }).heartbeat === "function") {
						await (executor as AgenticExecutor & { heartbeat: () => Promise<void> }).heartbeat();
					}
					let execution: ExecutionResult;
					const heartbeatTimer = setInterval(() => {
						const revision = this.store.operations.getDirection(item.id).revision;
						void this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "heartbeat", expectedRevision: revision, reason: "Renovar lease durante execução longa.", idempotencyKey: `${operationKey}:heartbeat:${Date.now()}` }).catch(() => undefined);
					}, Math.max(5_000, Math.min(30_000, this.intervalMs)));
					try {
						execution = await executor.execute({ itemId: claimed.id, item: claimed, agent: resolvedBinding?.identity?.displayName ?? actor, stage: item.stage, spec: claimed.spec ?? null, diff: null, snapshot: { stages: workflow.stages.map((entry) => ({ ...entry, agents: this.options.stageActors?.(entry.id) ?? (entry as typeof entry & { agents?: string[] }).agents })), executionWorkspace: executionWorkspace?.ok ? executionWorkspace.root : undefined, persona: resolvedBinding?.identity ? { id: resolvedBinding.identity.id, displayName: resolvedBinding.identity.displayName, role: resolvedBinding.binding?.roleId, skills: resolvedBinding.identity.skills, adapterHints: resolvedBinding.identity.adapterHints, stageBindings: resolvedBinding.identity.stageBindings, binding: resolvedBinding.binding } : undefined }, sessionLog: [], commands: [], prohibitions: [], promptTemplate: resolvedBinding?.binding?.promptTemplate ?? null } satisfies ExecutionContext);
					} finally {
						clearInterval(heartbeatTimer);
					}
					let latest = this.store.operations.getDirection(item.id);
					if (execution.success) {
						if (item.stage === "security" && this.store.operations.securityReview) {
							const securityReview = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) =>
								this.store.operations.securityReview!({ itemId: item.id, executorId: executor.id, actor, expectedRevision, reason: "Dispatcher executou a revisão de Security escopada antes do handoff.", idempotencyKey: `${operationKey}:security-review` }),
							);
							if (securityReview.outcome === "rejected") throw new SecurityReviewOperationError(securityReview);
						}
						const evidences = execution.evidences ?? [];
						if (evidences.length > 0) {
							const evidenceResult = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.evidence({ itemId: item.id, executorId: executor.id, actor, expectedRevision, reason: "Registrar evidências da execução autônoma.", evidence: evidences.map((value) => ({ kind: evidenceKind(value), value, source: "executor" })), idempotencyKey: `${operationKey}:evidence` }));
							if (evidenceResult.outcome !== "accepted") throw new Error(evidenceResult.reason);
							latest = evidenceResult.nextDirection;
						}
						const completed = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) =>
							this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "succeeded", expectedRevision, reason: "Registrar conclusão da execução autônoma.", idempotencyKey: `${operationKey}:succeeded` }),
						);
						if (completed.outcome !== "accepted") throw new Error(completed.reason);
						latest = completed.nextDirection;
						const handoff = execution.handoff;
						if (handoff) {
							const targetStage = workflow.stages.find((candidate) => (this.options.stageActors?.(candidate.id) ?? (candidate as typeof candidate & { agents?: string[] }).agents ?? []).includes(handoff.to));
							if (targetStage && targetStage.id !== item.stage) {
								const validation = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.validate({ actor, expectedRevision, reason: "Dispatcher executou a validação automatizada antes da transição." }));
								if (validation.outcome !== "accepted") {
									const failed = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "failed", expectedRevision, reason: "Validação automatizada bloqueou a transição.", message: validation.reason, errorCode: validation.reasonCode, recovery: "retry", idempotencyKey: `${operationKey}:validation-failed` }));
									if (failed.outcome === "accepted") await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.release({ itemId: item.id, actor, expectedRevision, reason: "Liberar claim após falha de validação.", idempotencyKey: `${operationKey}:release-validation` }));
									const result = { itemId: item.id, status: "failed" as const, reason: validation.reason };
									results.push(result); this.options.onResult?.(result); continue;
								}
								latest = validation.nextDirection;
								const transition = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.transition({ itemId: item.id, targetStageId: targetStage.id, actor, expectedRevision, reason: "Dispatcher avançou o item para o estágio do próximo actor.", idempotencyKey: `${operationKey}:transition` }));
								if (transition.outcome !== "accepted") throw new Error(transition.reason);
								latest = transition.nextDirection;
							}
							const handoffResult = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.handoff({ itemId: item.id, to: handoff.to, executorId: executor.id, actor, summary: handoff.summary, evidence: handoff.evidence ?? evidences ?? [], expectedRevision, reason: "Dispatcher emitiu handoff pelo gateway canônico.", idempotencyKey: `${operationKey}:handoff` }));
							if (handoffResult.outcome !== "accepted") throw new Error(handoffResult.reason);
						}
					} else {
						const failed = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "failed", expectedRevision, reason: "Registrar falha da execução autônoma.", message: execution.error ?? execution.output, errorCode: "EXECUTOR_FAILED", recovery: "release", idempotencyKey: `${operationKey}:failed` }));
						if (failed.outcome === "accepted") {
							await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.release({ itemId: item.id, actor, expectedRevision, reason: "Liberar claim após falha do executor; o handoff continua disponível para retry.", idempotencyKey: `${operationKey}:release-failed` }));
						}
					}
					const result = execution.success ? { itemId: item.id, status: "dispatched" as const } : { itemId: item.id, status: "failed" as const, reason: execution.error ?? execution.output };
					results.push(result); this.options.onResult?.(result);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					const failed = await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.event({ itemId: item.id, executorId: executor.id, actor, status: "failed", expectedRevision, reason: "Registrar exceção do executor autônomo.", message, errorCode: "EXECUTOR_EXCEPTION", recovery: "retry", idempotencyKey: `${operationKey}:exception` }));
					if (failed.outcome === "accepted") await withFreshRevision(this.store.operations.getDirection, item.id, (expectedRevision) => this.store.operations.release({ itemId: item.id, actor, expectedRevision, reason: "Liberar claim após exceção do executor.", idempotencyKey: `${operationKey}:release-exception` }));
					const operation = error instanceof SecurityReviewOperationError ? error.operation : undefined;
					const result = operation
						? { itemId: item.id, status: "failed" as const, reason: operation.reason, outcome: operation.outcome, reasonCode: operation.reasonCode, securityReview: operation.securityReview }
						: { itemId: item.id, status: "failed" as const, reason: error instanceof Error ? error.message : String(error) };
					results.push(result); this.options.onResult?.(result);
				}
			}
			return results;
		} finally { this.running = false; }
	}
}
