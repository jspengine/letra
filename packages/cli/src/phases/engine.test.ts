import { describe, expect, it } from "vitest";
import type { Workflow, Item } from "../commands/flow-init.js";
import type { StagePhases } from "../harness/types.js";
import {
	getStagePhases,
	getPhaseDef,
	enterStage,
	transitionPhase,
	getPhaseHarness,
} from "./engine.js";

function makeWorkflow(stages?: Workflow["stages"]): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: stages ?? [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "code-review", name: "Code Review", order: 4, phases: makeReviewPhases() as any },
			{ id: "done", name: "Done", order: 5 },
		],
		items: [],
		tools: [],
	};
}

function makeItem(overrides?: Partial<Item>): Item {
	return {
		id: "ITEM-1",
		description: "test",
		stage: "code-review",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeChainPhases(): StagePhases {
	return {
		initialState: "phase-a",
		states: {
			"phase-a": {
				id: "phase-a",
				label: "Phase A",
				description: "first",
				transitions: [{ target: "phase-b", auto: true }, { target: "phase-c" }],
				actions: [],
			},
			"phase-b": {
				id: "phase-b",
				label: "Phase B",
				description: "second",
				transitions: [{ target: "phase-c", auto: true }],
				actions: [],
			},
			"phase-c": {
				id: "phase-c",
				label: "Phase C",
				description: "third",
				transitions: [{ target: "__EXIT__" }],
				actions: [],
			},
		},
	};
}

function makeReviewPhases(): StagePhases {
	return {
		initialState: "auto-review",
		states: {
			"auto-review": {
				id: "auto-review",
				label: "Auto Review",
				description: "Agente revisa o diff e encontra issues",
				actions: [{ type: "agent-prompt", prompt: "Revise o diff e liste issues encontradas" }],
				transitions: [
					{ target: "code-fix", auto: true },
					{ target: "human-review" },
				],
				harness: {
					instructions: "Foque em encontrar bugs, violações de spec e problemas de segurança",
					checks: ["diff contra spec", "testes passando", "code style"],
				},
			},
			"code-fix": {
				id: "code-fix",
				label: "Code Fix",
				description: "Agente corrige issues encontradas",
				actions: [{ type: "command", cmd: "npm run fix" }],
				transitions: [{ target: "re-review" }],
			},
			"re-review": {
				id: "re-review",
				label: "Re-Review",
				description: "Agente verifica se correções foram aplicadas",
				actions: [{ type: "generate-report", template: "review-report" }],
				transitions: [
					{ target: "auto-review" },
					{ target: "human-review", auto: true },
				],
			},
			"human-review": {
				id: "human-review",
				label: "Human Review",
				description: "Humano aprova ou rejeita as mudanças",
				actions: [
					{ type: "notify-human", message: "Código pronto para revisão humana" },
					{ type: "wait-human", gate: "human-approved-code" },
				],
				transitions: [
					{ target: "code-fix" },
					{ target: "__EXIT__" },
				],
			},
		},
	};
}

describe("getStagePhases", () => {
	it("AC10a: returns null for nonexistent stage", () => {
		const wf = makeWorkflow();
		expect(getStagePhases(wf, "nope")).toBeNull();
	});

	it("AC10b: returns null for stage without phases", () => {
		const wf = makeWorkflow();
		expect(getStagePhases(wf, "backlog")).toBeNull();
	});

	it("returns inline phases for stage", () => {
		const wf = makeWorkflow();
		const result = getStagePhases(wf, "code-review");
		expect(result).toEqual(makeReviewPhases());
	});

	it("returns stage-specific phases when overridden", () => {
		const wf = makeWorkflow([
			{ id: "code-review", name: "CR", order: 0, phases: { initialState: "x", states: {} } as any },
		]);
		const result = getStagePhases(wf, "code-review");
		expect(result).toEqual({ initialState: "x", states: {} });
	});
});

describe("getPhaseDef", () => {
	it("AC11: returns null for nonexistent phaseId", () => {
		const phases = makeReviewPhases();
		expect(getPhaseDef(phases, "nope")).toBeNull();
	});

	it("returns phase def for valid phaseId", () => {
		const phases = makeReviewPhases();
		const def = getPhaseDef(phases, "auto-review");
		expect(def).not.toBeNull();
		expect(def?.label).toBe("Auto Review");
	});
});

describe("enterStage", () => {
	it("AC1: sets currentPhase to initialState when stage has phases", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review" });
		const result = enterStage(wf, item);
		expect(result.ok).toBe(true);
		expect(result.phase).toBe("auto-review");
		expect(item.currentPhase).toBe("auto-review");
	});

	it("AC2: clears currentPhase when stage has no phases", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "backlog", currentPhase: "something" as any });
		const result = enterStage(wf, item);
		expect(result.ok).toBe(true);
		expect(result.phase).toBeUndefined();
		expect(item.currentPhase).toBeUndefined();
	});

	it("AC3: returns error when initialState does not exist in states", () => {
		const wf = makeWorkflow([
			{
				id: "custom",
				name: "Custom",
				order: 0,
				phases: { initialState: "missing", states: { "other": { id: "other", label: "O", description: "d" } as any } } as any,
			},
		]);
		const item = makeItem({ stage: "custom" });
		const result = enterStage(wf, item);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("missing");
		expect(result.error).toContain("custom");
	});
});

describe("transitionPhase", () => {
	it("AC4: valid transition updates currentPhase", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const result = transitionPhase(undefined, wf, item, "human-review");
		expect(result.ok).toBe(true);
		expect(result.phase).toBe("human-review");
		expect(item.currentPhase).toBe("human-review");
	});

	it("AC5: invalid transition returns error", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const result = transitionPhase(undefined, wf, item, "re-review");
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Transition");
		expect(result.error).toContain("auto-review");
		expect(result.error).toContain("re-review");
	});

	it("AC6: transition to __EXIT__ clears currentPhase", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "human-review" });
		const result = transitionPhase(undefined, wf, item, "__EXIT__");
		expect(result.ok).toBe(true);
		expect(result.phase).toBeUndefined();
		expect(item.currentPhase).toBeUndefined();
	});

	it("AC6b: __EXIT__ from phase without exit transition returns error", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const result = transitionPhase(undefined, wf, item, "__EXIT__");
		expect(result.ok).toBe(false);
		expect(result.error).toContain("not allowed");
	});

	it("AC7: auto transition jumps to next phase", () => {
		const wf = makeWorkflow([
			{ id: "code-review", name: "CR", order: 0, phases: makeChainPhases() as any },
		]);
		const item = makeItem({ stage: "code-review", currentPhase: "phase-a" });
		const result = transitionPhase(undefined, wf, item, "phase-b");
		expect(result.ok).toBe(true);
		expect(result.triggeredAutoTransition).toBe(true);
		expect(item.currentPhase).toBe("phase-c");
	});

	it("AC8: transition in stage without phases returns error", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "backlog", currentPhase: undefined });
		const result = transitionPhase(undefined, wf, item, "some-phase");
		expect(result.ok).toBe(false);
		expect(result.error).toContain("no phases");
	});

	it("AC9: transition to nonexistent phase returns error", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const result = transitionPhase(undefined, wf, item, "nope");
		expect(result.ok).toBe(false);
		expect(result.error).toContain("not found");
		expect(result.error).toContain("nope");
	});

	it("AC13: auto transition chain (2 levels)", () => {
		const wf = makeWorkflow([
			{ id: "chain-stage", name: "Chain", order: 0, phases: makeChainPhases() as any },
		]);
		const item = makeItem({ stage: "chain-stage", currentPhase: "phase-a" });
		const result = transitionPhase(undefined, wf, item, "phase-c");
		expect(result.ok).toBe(true);
		expect(item.currentPhase).toBe("phase-c");
		expect(result.triggeredAutoTransition).toBe(false);
	});

	it("AC13b: 2-level cascade (A auto→B auto→C)", () => {
		const wf = makeWorkflow([
			{ id: "cr", name: "CR", order: 0, phases: makeChainPhases() as any },
		]);
		const item = makeItem({ stage: "cr", currentPhase: "phase-a" });
		const r1 = transitionPhase(undefined, wf, item, "phase-b");
		expect(r1.ok).toBe(true);
		expect(r1.triggeredAutoTransition).toBe(true);
		expect(item.currentPhase).toBe("phase-c");
		const r2 = transitionPhase(undefined, wf, item, "__EXIT__");
		expect(r2.ok).toBe(true);
		expect(item.currentPhase).toBeUndefined();
	});
});

describe("getPhaseHarness", () => {
	it("AC12a: returns harness for current phase", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const harness = getPhaseHarness(wf, item);
		expect(harness).not.toBeNull();
		expect(harness?.instructions).toContain("bugs");
		expect(harness?.checks).toHaveLength(3);
	});

	it("AC12b: returns null when no current phase", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: undefined });
		expect(getPhaseHarness(wf, item)).toBeNull();
	});

	it("AC12c: returns null when stage has no phases", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "backlog", currentPhase: undefined });
		expect(getPhaseHarness(wf, item)).toBeNull();
	});
});

describe("transitionPhase actions", () => {
	it("returns triggered action descriptions", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "code-review", currentPhase: "auto-review" });
		const result = transitionPhase(undefined, wf, item, "human-review");
		expect(result.ok).toBe(true);
		expect(result.triggeredActions).toBeDefined();
		expect(result.triggeredActions?.length).toBeGreaterThan(0);
	});

	it("handles wait-human action type", () => {
		const phases = makeReviewPhases();
		const hr = phases.states["human-review"];
		const waitAction = hr.actions?.find((a) => a.type === "wait-human");
		expect(waitAction).toBeDefined();
		expect(waitAction?.gate).toBe("human-approved-code");
	});
});
