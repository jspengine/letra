import { describe, expect, it } from "vitest";
import {
	evaluateTransitionRepetition,
	validateTransitionRepetition,
	type RepetitionState,
	type RepetitionStage,
} from "./repetition-policy.js";

const finiteLoop: RepetitionStage[] = [
	{ id: "work", transitions: [{ target: "review" }] },
	{ id: "review", transitions: [{ target: "work", repetition: { mode: "finite", maxTraversals: 2 } }, { target: "done" }] },
	{ id: "done", transitions: [] },
];

describe("workflow transition repetition policy", () => {
	it("requires explicit semantics for every edge in a cycle but allows acyclic edges without policy", () => {
		const missing = validateTransitionRepetition([
			{ id: "a", transitions: [{ target: "b" }] },
			{ id: "b", transitions: [{ target: "a" }] },
		]);
		expect(missing.map((error) => error.code)).toContain("TRANSITION_REPETITION_REQUIRED");
		expect(validateTransitionRepetition([
			{ id: "a", transitions: [{ target: "b" }] },
			{ id: "b", transitions: [{ target: "done" }] },
			{ id: "done", transitions: [] },
		])).toEqual([]);
	});

	it("allows exactly maxTraversals successful visits and rejects the next without changing state", () => {
		let state: RepetitionState = {};
		for (let index = 0; index < 2; index++) {
			const decision = evaluateTransitionRepetition({ stages: finiteLoop, workflowVersionId: "v1", from: "review", to: "work", item: { repetitionState: state }, now: 1_000 + index });
			expect(decision.outcome).toBe("allow");
			if (decision.outcome === "allow") state = decision.state;
		}
		const rejected = evaluateTransitionRepetition({ stages: finiteLoop, workflowVersionId: "v1", from: "review", to: "work", item: { repetitionState: state }, now: 2_000 });
		expect(rejected).toMatchObject({ outcome: "reject", reasonCode: "TRANSITION_REPETITION_LIMIT_REACHED" });
		expect(state[JSON.stringify(["v1", "review", "work"])].count).toBe(2);
	});

	it("evaluates exit conditions without executing arbitrary expressions", () => {
		const stages: RepetitionStage[] = [
			{ id: "work", transitions: [{ target: "work", repetition: { mode: "exit-condition", condition: { field: "progress", operator: "gte", value: 3 } } }] },
		];
		const allowed = evaluateTransitionRepetition({ stages, workflowVersionId: "v1", from: "work", to: "work", item: { progress: 2 }, now: 1_000 });
		const stopped = evaluateTransitionRepetition({ stages, workflowVersionId: "v1", from: "work", to: "work", item: { progress: 3 }, now: 2_000 });
		expect(allowed.outcome).toBe("allow");
		expect(stopped).toMatchObject({ outcome: "reject", reasonCode: "TRANSITION_REPETITION_EXIT_CONDITION_MET" });
	});

	it("returns only the timeout outcome declared by the edge", () => {
		const waitStages: RepetitionStage[] = [
			{ id: "work", transitions: [{ target: "review" }] },
			{ id: "review", transitions: [{ target: "work", repetition: { mode: "timeout", timeoutMs: 100, timeoutResult: { type: "wait-human" } } }, { target: "done" }] },
			{ id: "done", transitions: [] },
		];
		const initial = evaluateTransitionRepetition({ stages: waitStages, workflowVersionId: "v1", from: "review", to: "work", item: {}, now: 1_000 });
		const waiting = evaluateTransitionRepetition({ stages: waitStages, workflowVersionId: "v1", from: "review", to: "work", item: { repetitionState: initial.outcome === "allow" ? initial.state : {} }, now: 1_100 });
		expect(initial.outcome).toBe("allow");
		expect(waiting.outcome).toBe("wait-human");
	});

	it("validates timeout target and malformed policy fields", () => {
		const invalid = validateTransitionRepetition([
			{ id: "work", transitions: [{ target: "review" }] },
			{ id: "review", transitions: [{ target: "work", repetition: { mode: "finite", maxTraversals: 0 } as never }, { target: "done", repetition: { mode: "timeout", timeoutMs: 0, timeoutResult: { type: "transition", target: "missing" } } as never }] },
			{ id: "done", transitions: [] },
		]);
		expect(invalid.map((error) => error.code)).toEqual(expect.arrayContaining([
			"TRANSITION_REPETITION_LIMIT_INVALID",
			"TRANSITION_TIMEOUT_INVALID",
			"TRANSITION_TIMEOUT_TARGET_NOT_CONFIGURED",
			"TRANSITION_TARGET_NOT_FOUND",
		]));
	});
});
