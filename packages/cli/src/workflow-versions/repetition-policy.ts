export type RepetitionCondition = {
	field: string;
	operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
	value: string | number | boolean | null;
};

export type RepetitionPolicy =
	| { mode: "finite"; maxTraversals: number }
	| { mode: "exit-condition"; condition: RepetitionCondition }
	| {
			mode: "timeout";
			timeoutMs: number;
			timeoutResult:
				| { type: "wait-human" }
				| { type: "transition"; target: string };
		};

export interface ConfiguredStageTransition {
	target: string;
	gate?: string;
	allowPendingAcceptanceCriteria?: boolean;
	repetition?: RepetitionPolicy;
}

export interface RepetitionStateEntry {
	count: number;
	firstTraversalAt: string;
}

export type RepetitionState = Record<string, RepetitionStateEntry>;

export interface RepetitionStage {
	id: string;
	transitions?: ConfiguredStageTransition[];
}

export type RepetitionEvaluation =
	| { outcome: "allow"; state: RepetitionState }
	| { outcome: "reject"; reasonCode: string; reason: string }
	| { outcome: "wait-human"; state: RepetitionState }
	| { outcome: "redirect"; target: string; state: RepetitionState };

export interface RepetitionValidationError {
	code: string;
	message: string;
	path: string;
}

const operators = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);
const scalar = (value: unknown): value is string | number | boolean | null =>
	value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

function edgeKey(workflowVersionId: string, from: string, to: string): string {
	return JSON.stringify([workflowVersionId, from, to]);
}

function edgeIsCyclic(stages: readonly RepetitionStage[], from: string, to: string): boolean {
	if (from === to) return true;
	const byId = new Map(stages.map((stage) => [stage.id, stage]));
	const visited = new Set<string>();
	const pending = [to];
	while (pending.length) {
		const current = pending.pop()!;
		if (current === from) return true;
		if (visited.has(current)) continue;
		visited.add(current);
		for (const transition of byId.get(current)?.transitions ?? []) {
			if (!visited.has(transition.target)) pending.push(transition.target);
		}
	}
	return false;
}

function validatePolicy(policy: unknown, path: string): RepetitionValidationError[] {
	const errors: RepetitionValidationError[] = [];
	const add = (code: string, message: string, at = path) => errors.push({ code, message, path: at });
	if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
		add("TRANSITION_REPETITION_POLICY_INVALID", "repetition must be an object with a supported mode");
		return errors;
	}
	const value = policy as Record<string, unknown>;
	if (value.mode === "finite") {
		if (Object.keys(value).some((key) => !["mode", "maxTraversals"].includes(key))) add("TRANSITION_REPETITION_POLICY_INVALID", "finite repetition only supports maxTraversals");
		if (!Number.isSafeInteger(value.maxTraversals) || (value.maxTraversals as number) < 1) add("TRANSITION_REPETITION_LIMIT_INVALID", "maxTraversals must be a positive safe integer", `${path}.maxTraversals`);
		return errors;
	}
	if (value.mode === "exit-condition") {
		if (Object.keys(value).some((key) => !["mode", "condition"].includes(key))) add("TRANSITION_REPETITION_POLICY_INVALID", "exit-condition repetition only supports condition");
		const condition = value.condition;
		if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
			add("TRANSITION_EXIT_CONDITION_INVALID", "condition must be an object", `${path}.condition`);
			return errors;
		}
		const candidate = condition as Record<string, unknown>;
		if (Object.keys(candidate).some((key) => !["field", "operator", "value"].includes(key))) add("TRANSITION_EXIT_CONDITION_INVALID", "condition only supports field, operator and value", `${path}.condition`);
		if (typeof candidate.field !== "string" || !candidate.field.trim() || candidate.field.split(".").some((part) => !part || ["__proto__", "prototype", "constructor"].includes(part))) add("TRANSITION_EXIT_CONDITION_INVALID", "field must be a safe, non-empty property path", `${path}.condition.field`);
		if (typeof candidate.operator !== "string" || !operators.has(candidate.operator)) add("TRANSITION_EXIT_CONDITION_INVALID", "operator is not supported", `${path}.condition.operator`);
		if (!scalar(candidate.value)) add("TRANSITION_EXIT_CONDITION_INVALID", "value must be a finite scalar or null", `${path}.condition.value`);
		if (["gt", "gte", "lt", "lte"].includes(String(candidate.operator)) && typeof candidate.value !== "number") add("TRANSITION_EXIT_CONDITION_INVALID", "numeric operators require a numeric value", `${path}.condition.value`);
		return errors;
	}
	if (value.mode === "timeout") {
		if (Object.keys(value).some((key) => !["mode", "timeoutMs", "timeoutResult"].includes(key))) add("TRANSITION_REPETITION_POLICY_INVALID", "timeout repetition only supports timeoutMs and timeoutResult");
		if (!Number.isSafeInteger(value.timeoutMs) || (value.timeoutMs as number) < 1) add("TRANSITION_TIMEOUT_INVALID", "timeoutMs must be a positive safe integer", `${path}.timeoutMs`);
		const outcome = value.timeoutResult;
		if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
			add("TRANSITION_TIMEOUT_RESULT_INVALID", "timeoutResult must explicitly select wait-human or transition", `${path}.timeoutResult`);
			return errors;
		}
		const result = outcome as Record<string, unknown>;
		if (result.type === "wait-human") {
			if (Object.keys(result).some((key) => key !== "type")) add("TRANSITION_TIMEOUT_RESULT_INVALID", "wait-human timeout result does not accept extra fields", `${path}.timeoutResult`);
		} else if (result.type === "transition") {
			if (Object.keys(result).some((key) => !["type", "target"].includes(key))) add("TRANSITION_TIMEOUT_RESULT_INVALID", "transition timeout result only supports target", `${path}.timeoutResult`);
			if (typeof result.target !== "string" || !result.target.trim()) add("TRANSITION_TIMEOUT_RESULT_INVALID", "transition timeout result requires a target", `${path}.timeoutResult.target`);
		} else {
			add("TRANSITION_TIMEOUT_RESULT_INVALID", "timeoutResult type is unsupported", `${path}.timeoutResult.type`);
		}
		return errors;
	}
	add("TRANSITION_REPETITION_MODE_INVALID", "repetition mode must be finite, exit-condition or timeout", `${path}.mode`);
	return errors;
}

export function validateTransitionRepetition(stages: readonly RepetitionStage[]): RepetitionValidationError[] {
	const errors: RepetitionValidationError[] = [];
	const byId = new Map(stages.map((stage) => [stage.id, stage]));
	for (const [stageIndex, stage] of stages.entries()) {
		for (const [transitionIndex, transition] of (stage.transitions ?? []).entries()) {
			const path = `stages.${stageIndex}.transitions.${transitionIndex}.repetition`;
			if (transition.repetition !== undefined) errors.push(...validatePolicy(transition.repetition, path));
			if (edgeIsCyclic(stages, stage.id, transition.target) && transition.repetition === undefined) {
				errors.push({ code: "TRANSITION_REPETITION_REQUIRED", message: `cyclic transition ${stage.id} -> ${transition.target} requires an explicit repetition policy`, path });
			}
			if ((transition.repetition as RepetitionPolicy | undefined)?.mode === "timeout") {
				const result = (transition.repetition as Extract<RepetitionPolicy, { mode: "timeout" }>).timeoutResult;
				if (result?.type === "transition") {
					if (result.target === transition.target) errors.push({ code: "TRANSITION_TIMEOUT_RESULT_INVALID", message: "timeout transition target must differ from the repeated edge target", path: `${path}.timeoutResult.target` });
					if (!stage.transitions?.some((edge) => edge.target === result.target)) errors.push({ code: "TRANSITION_TIMEOUT_TARGET_NOT_CONFIGURED", message: `timeout target ${result.target} must be a separately declared edge from ${stage.id}`, path: `${path}.timeoutResult.target` });
					if (!byId.has(result.target)) errors.push({ code: "TRANSITION_TARGET_NOT_FOUND", message: `timeout target ${result.target} does not exist`, path: `${path}.timeoutResult.target` });
				}
			}
		}
	}
	return errors;
}

function readField(item: Record<string, unknown>, path: string): unknown {
	let value: unknown = item;
	for (const part of path.split(".")) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
		value = (value as Record<string, unknown>)[part];
	}
	return value;
}

function exitConditionMet(item: Record<string, unknown>, condition: RepetitionCondition): boolean {
	const actual = readField(item, condition.field);
	switch (condition.operator) {
		case "eq": return actual === condition.value;
		case "neq": return actual !== condition.value;
		case "gt": return typeof actual === "number" && actual > (condition.value as number);
		case "gte": return typeof actual === "number" && actual >= (condition.value as number);
		case "lt": return typeof actual === "number" && actual < (condition.value as number);
		case "lte": return typeof actual === "number" && actual <= (condition.value as number);
	}
}

export function evaluateTransitionRepetition(args: {
	stages: readonly RepetitionStage[];
	workflowVersionId: string;
	from: string;
	to: string;
	item: Record<string, unknown>;
	now?: number;
}): RepetitionEvaluation {
	const source = args.stages.find((stage) => stage.id === args.from);
	const edge = source?.transitions?.find((transition) => transition.target === args.to);
	if (!edge) return { outcome: "reject", reasonCode: "TRANSITION_NOT_CONFIGURED", reason: `Transition ${args.from} -> ${args.to} is not declared.` };
	const policy = edge.repetition;
	if (edgeIsCyclic(args.stages, args.from, args.to) && !policy) return { outcome: "reject", reasonCode: "TRANSITION_REPETITION_REQUIRED", reason: `Cyclic transition ${args.from} -> ${args.to} has no repetition policy.` };
	const state = (args.item.repetitionState && typeof args.item.repetitionState === "object" && !Array.isArray(args.item.repetitionState) ? args.item.repetitionState : {}) as RepetitionState;
	if (!policy) return { outcome: "allow", state };
	const key = edgeKey(args.workflowVersionId, args.from, args.to);
	const prior = state[key];
	if (prior && (!Number.isSafeInteger(prior.count) || prior.count < 1 || !Number.isFinite(Date.parse(prior.firstTraversalAt)))) return { outcome: "reject", reasonCode: "TRANSITION_REPETITION_STATE_INVALID", reason: `Stored repetition state for ${args.from} -> ${args.to} is invalid.` };
	const now = args.now ?? Date.now();
	const firstTraversalAt = prior?.firstTraversalAt ?? new Date(now).toISOString();
	const next = (count: number): RepetitionState => ({ ...state, [key]: { count, firstTraversalAt } });
	if (policy.mode === "finite") {
		if (prior && prior.count >= policy.maxTraversals) return { outcome: "reject", reasonCode: "TRANSITION_REPETITION_LIMIT_REACHED", reason: `Transition ${args.from} -> ${args.to} reached maxTraversals=${policy.maxTraversals}.` };
		return { outcome: "allow", state: next((prior?.count ?? 0) + 1) };
	}
	if (policy.mode === "exit-condition") {
		if (exitConditionMet(args.item, policy.condition)) return { outcome: "reject", reasonCode: "TRANSITION_REPETITION_EXIT_CONDITION_MET", reason: `Exit condition for transition ${args.from} -> ${args.to} is met.` };
		return { outcome: "allow", state: next((prior?.count ?? 0) + 1) };
	}
	if (prior && now - Date.parse(prior.firstTraversalAt) >= policy.timeoutMs) {
		return policy.timeoutResult.type === "wait-human"
			? { outcome: "wait-human", state }
			: { outcome: "redirect", target: policy.timeoutResult.target, state };
	}
	return { outcome: "allow", state: next((prior?.count ?? 0) + 1) };
}
