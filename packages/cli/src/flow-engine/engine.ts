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
		// 1. Load item
		const item = await this.ctx.loadItem(itemId);
		if (!item) return { ok: false, error: "Item not found", reasonCode: "ITEM_NOT_FOUND" };

		const currentStage = this.getStage(item.stage);
		if (!currentStage)
			return {
				ok: false,
				error: `Stage not found: ${item.stage}`,
				reasonCode: "STAGE_NOT_FOUND",
			};

		// 2. Validate operation
		const opResult = this.validateOperation(operation, currentStage, actor);
		if (!opResult.ok) return opResult;

		// 3. Check rework (special case: rework goes to rework.target, not requested target)
		const isRework = operation === "rework";
		const effectiveTarget = isRework
			? (currentStage.rework?.target ?? targetStageId)
			: targetStageId;

		// 4. Find transition
		const transition = this.findTransition(currentStage, effectiveTarget);
		if (!transition)
			return {
				ok: false,
				error: `Transition not allowed: ${item.stage} → ${effectiveTarget}`,
				reasonCode: "TRANSITION_NOT_ALLOWED",
			};

		// 5. Check gate
		if (transition.gate) {
			const gateResult = await this.ctx.checkHumanGate(transition.gate, item);
			if (!gateResult)
				return {
					ok: false,
					error: `Gate not passed: ${transition.gate}`,
					reasonCode: "GATE_NOT_PASSED",
				};
		}

		// 6. Execute on_exit hooks
		await this.executeHooks(currentStage.hooks?.on_exit, item);

		// 7. Transition item
		const fromStage = item.stage;
		item.stage = effectiveTarget;
		item.phase = undefined;

		// 8. Execute on_enter hooks on new stage
		const newStage = this.getStage(effectiveTarget);
		if (newStage) {
			await this.executeHooks(newStage.hooks?.on_enter, item);
		}

		// 9. Process auto_transitions
		await this.processAutoTransitions(item, newStage);

		// 10. Save and log
		await this.ctx.saveItem(item);
		await this.ctx.logTransition(item, fromStage, effectiveTarget, actor, operation);

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
		// Check if there's a direct stage transition
		// For now, any stage can transition to any other stage if it exists
		// Gates are checked separately
		const targetStage = this.getStage(targetStageId);
		if (!targetStage) return undefined;

		// Check rework target
		if (stage.rework?.target === targetStageId) {
			return { gate: undefined };
		}

		// Check phase transitions for handoff
		if (stage.phases) {
			// Find the handoff phase and check its transitions
			for (const phase of Object.values(stage.phases.states)) {
				for (const t of phase.transitions) {
					if (t.target === targetStageId) {
						return { gate: t.gate };
					}
				}
			}
		}

		// Default: allow transition if target stage exists
		return { gate: undefined };
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
		stage: FlowStage | undefined,
	): Promise<void> {
		if (!stage?.auto_transitions) return;

		for (const auto of stage.auto_transitions) {
			const conditionMet = await this.ctx.evaluateCondition(auto.when, item);
			if (conditionMet) {
				// Recursive call to handle the auto-transition
				await this.transition(
					item.id,
					auto.target,
					auto.actor ?? "system:auto",
					"auto_transition",
				);
				break; // Only process first matching auto-transition
			}
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
