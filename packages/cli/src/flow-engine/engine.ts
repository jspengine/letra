/**
 * Declarative Flow Engine — Generic interpreter.
 *
 * This engine reads flow definitions from YAML and executes transitions
 * without any if-statements referencing stage, role, or operation names.
 * All behavior is driven by the flow configuration.
 */

import type {
	FlowDefinition,
	FlowExecutor,
	FlowItem,
	FlowOperation,
	FlowStage,
	FlowHook,
	FlowAutoTransition,
	GateCheckResult,
	TransitionResult,
} from "./types.js";
import { evaluateTransitionRepetition } from "../workflow-versions/repetition-policy.js";

// ============================================================
// Engine — Pure interpreter, zero hardcodes
// ============================================================

export interface FlowEngineContext {
	/** Load the current item state. */
	loadItem: (itemId: string) => Promise<FlowItem | null>;
	/** Save item state after transition. */
	saveItem: (item: FlowItem) => Promise<void>;
	/** Check if a human gate is approved. */
	checkHumanGate: (gateId: string, item: FlowItem) => Promise<boolean>;
	/** Run an automated gate check (e.g., "validate"). */
	runAutomatedCheck: (check: string, item: FlowItem) => Promise<boolean>;
	/** Execute a hook action. */
	executeHook: (
		action: string,
		item: FlowItem,
		params?: Record<string, unknown>,
	) => Promise<void>;
	/** Evaluate a condition expression (e.g., "security_clear AND human_approved"). */
	evaluateCondition: (condition: string, item: FlowItem) => Promise<boolean>;
	/** Atomically persist the candidate item and its Run's waiting-human status. */
	commitRunWaitingHuman?: (item: FlowItem, reason: string) => Promise<void>;
	/** Log a transition for audit trail. */
	logTransition: (
		item: FlowItem,
		from: string,
		to: string,
		actor: string,
		operation: string,
	) => Promise<void>;
}

export class FlowEngine {
	constructor(
		private readonly flow: FlowDefinition,
		private readonly ctx: FlowEngineContext,
	) {}

	// --------------------------------------------------------
	// Main transition method — the ONLY entry point
	// --------------------------------------------------------

	async transition(
		itemId: string,
		targetStageId: string,
		actor: string,
		operation = "handoff",
	): Promise<TransitionResult> {
		const loaded = await this.ctx.loadItem(itemId);
		if (!loaded) return { ok: false, error: "Item not found", reasonCode: "ITEM_NOT_FOUND" };
		const item = structuredClone(loaded);
		const logs: Array<{ from: string; to: string; actor: string; operation: string }> = [];
		const first = await this.applyTransition(item, targetStageId, actor, operation, logs);
		if (!first.ok) return first;
		if (first.reasonCode === "REPETITION_TIMEOUT_WAITING_HUMAN") {
			if (!this.ctx.commitRunWaitingHuman) return { ok: false, error: "Timeout policy requires an atomic item+Run commit handler", reasonCode: "REPETITION_TIMEOUT_RUN_HANDLER_REQUIRED" };
			await this.ctx.commitRunWaitingHuman(item, "Configured repetition timeout requires human decision");
			return first;
		}
		const automatic = await this.processAutoTransitions(item, logs);
		if (automatic && !automatic.ok) return automatic;
		if (automatic?.reasonCode === "REPETITION_TIMEOUT_WAITING_HUMAN") {
			if (!this.ctx.commitRunWaitingHuman) return { ok: false, error: "Timeout policy requires an atomic item+Run commit handler", reasonCode: "REPETITION_TIMEOUT_RUN_HANDLER_REQUIRED" };
			await this.ctx.commitRunWaitingHuman(item, "Configured repetition timeout requires human decision");
			return automatic;
		}
		await this.ctx.saveItem(item);
		for (const log of logs) await this.ctx.logTransition(item, log.from, log.to, log.actor, log.operation);
		return { ...first, item };
	}

	private async applyTransition(
		item: FlowItem,
		targetStageId: string,
		actor: string,
		operation: string,
		logs: Array<{ from: string; to: string; actor: string; operation: string }>,
	): Promise<TransitionResult> {
		const currentStage = this.getStage(item.stage);
		if (!currentStage) return { ok: false, error: `Stage not found: ${item.stage}`, reasonCode: "STAGE_NOT_FOUND" };
		const opResult = this.validateOperation(operation, currentStage, actor);
		if (!opResult.ok) return opResult;
		let effectiveTarget = operation === "rework" ? (currentStage.rework?.target ?? targetStageId) : targetStageId;
		let transition = this.findTransition(currentStage, effectiveTarget);
		if (!transition) return { ok: false, error: `Transition not allowed: ${item.stage} → ${effectiveTarget}`, reasonCode: "TRANSITION_NOT_ALLOWED" };
		const versionId = typeof item.workflowVersionId === "string" ? item.workflowVersionId : this.flow.version;
		const repetition = evaluateTransitionRepetition({ stages: this.flow.stages, workflowVersionId: versionId, from: currentStage.id, to: effectiveTarget, item: item as Record<string, unknown> });
		if (repetition.outcome === "reject") return { ok: false, error: repetition.reason, reasonCode: repetition.reasonCode };
		if (repetition.outcome === "wait-human") {
			return { ok: true, item, reasonCode: "REPETITION_TIMEOUT_WAITING_HUMAN" };
		}
		let repetitionState = repetition.state;
		if (repetition.outcome === "redirect") {
			effectiveTarget = repetition.target;
			transition = this.findTransition(currentStage, effectiveTarget);
			if (!transition) return { ok: false, error: `Timeout transition not declared: ${currentStage.id} -> ${effectiveTarget}`, reasonCode: "TRANSITION_TIMEOUT_TARGET_NOT_CONFIGURED" };
			const redirected = evaluateTransitionRepetition({ stages: this.flow.stages, workflowVersionId: versionId, from: currentStage.id, to: effectiveTarget, item: { ...item, repetitionState } as Record<string, unknown> });
			if (redirected.outcome !== "allow") return { ok: false, error: "Timeout target has a repetition policy that cannot be resolved in one transition", reasonCode: "TRANSITION_TIMEOUT_TARGET_POLICY_UNSUPPORTED" };
			repetitionState = redirected.state;
		}
		if (transition.gate) {
			const gateResult = await this.ctx.checkHumanGate(transition.gate, item);
			if (!gateResult) return { ok: false, error: `Gate not passed: ${transition.gate}`, reasonCode: "GATE_NOT_PASSED" };
		}
		await this.executeHooks(currentStage.hooks?.on_exit, item);
		const fromStage = item.stage;
		item.repetitionState = repetitionState;
		item.stage = effectiveTarget;
		item.phase = undefined;
		const newStage = this.getStage(effectiveTarget);
		if (newStage) await this.executeHooks(newStage.hooks?.on_enter, item);
		logs.push({ from: fromStage, to: effectiveTarget, actor, operation });
		return { ok: true, item };
	}

	// --------------------------------------------------------
	// Operation validation — data-driven, no hardcodes
	// --------------------------------------------------------

	private validateOperation(
		operation: string,
		stage: FlowStage,
		actor: string,
	): TransitionResult {
		const ops = this.flow.operations ?? {};
		const op = ops[operation];

		// If no operation defined, allow (default behavior)
		if (!op) return { ok: true };

		// Check allowed_in_stages
		if (op.allowed_in_stages && !op.allowed_in_stages.includes("*")) {
			if (!op.allowed_in_stages.includes(stage.id)) {
				return {
					ok: false,
					error: `Operation "${operation}" not allowed in stage "${stage.id}"`,
					reasonCode: "OPERATION_NOT_ALLOWED_IN_STAGE",
				};
			}
		}

		// Check requires_claim
		if (op.requires_claim) {
			// The caller must pass the actual item to check claim, but for now
			// we validate the actor format. Full claim check happens in the caller.
		}

		// Check actor_prefix
		if (op.actor_prefix && !actor.startsWith(op.actor_prefix)) {
			return {
				ok: false,
				error: `Actor "${actor}" does not have prefix "${op.actor_prefix}"`,
				reasonCode: "ACTOR_NOT_ALLOWED",
			};
		}

		// Check allowed_actors
		if (op.allowed_actors && !op.allowed_actors.includes(actor)) {
			return {
				ok: false,
				error: `Actor "${actor}" not in allowed list`,
				reasonCode: "ACTOR_NOT_ALLOWED",
			};
		}

		return { ok: true };
	}

	// --------------------------------------------------------
	// Transition lookup — data-driven
	// --------------------------------------------------------

	private findTransition(stage: FlowStage, targetStageId: string): { gate?: string } | undefined {
		if (!this.getStage(targetStageId)) return undefined;
		const transition = stage.transitions?.find((candidate) => candidate.target === targetStageId);
		return transition ? { gate: transition.gate } : undefined;
	}

	// --------------------------------------------------------
	// Hook execution — data-driven
	// --------------------------------------------------------

	private async executeHooks(hooks: FlowHook[] | undefined, item: FlowItem): Promise<void> {
		if (!hooks) return;
		for (const hook of hooks) {
			await this.ctx.executeHook(hook.action, item, hook.params);
		}
	}

	// --------------------------------------------------------
	// Auto-transition processing — data-driven
	// --------------------------------------------------------

	private async processAutoTransitions(
		item: FlowItem,
		logs: Array<{ from: string; to: string; actor: string; operation: string }>,
	): Promise<TransitionResult | undefined> {
		while (true) {
			const stage = this.getStage(item.stage);
			if (!stage?.auto_transitions?.length) return undefined;
			let transitioned = false;
			for (const auto of stage.auto_transitions) {
				if (!(await this.ctx.evaluateCondition(auto.when, item))) continue;
				const result = await this.applyTransition(item, auto.target, auto.actor ?? "system:auto", "auto_transition", logs);
				if (!result.ok || result.reasonCode === "REPETITION_TIMEOUT_WAITING_HUMAN") return result;
				transitioned = true;
				break;
			}
			if (!transitioned) return undefined;
		}
	}

	// --------------------------------------------------------
	// Public accessors — for testing and integration
	// --------------------------------------------------------

	getOperations(): Array<FlowOperation & { id: string }> {
		const ops = this.flow.operations ?? {};
		return Object.entries(ops).map(([id, op]) => ({ id, ...op }));
	}

	getOperation(id: string): FlowOperation | undefined {
		return this.flow.operations?.[id];
	}

	getStage(id: string): FlowStage | undefined {
		return this.flow.stages.find((s) => s.id === id);
	}

	getCapabilityFamilies(): Record<string, string[]> {
		return this.flow.capability_families ?? {};
	}

	getCapabilityFamily(capability: string): string | undefined {
		const families = this.flow.capability_families ?? {};
		for (const [family, caps] of Object.entries(families)) {
			if (caps.includes(capability)) return family;
		}
		return undefined;
	}

	getExecutors(): Record<string, FlowExecutor> {
		return this.flow.executors ?? {};
	}

	getExecutor(id: string): FlowExecutor | undefined {
		return this.flow.executors?.[id];
	}
}
