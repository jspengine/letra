import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Workflow, Item } from "../commands/flow-init.js";
import type { StagePhases } from "../harness/types.js";
import { PhaseAutoPilot, autopilotRun, canAutopilot } from "./autopilot.js";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(() => Buffer.from("")),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		readdirSync: vi.fn(() => []),
		existsSync: vi.fn(() => true),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		readFileSync: vi.fn(() => ""),
	};
});

vi.mock("../session-log.js", () => ({
	logEntry: vi.fn(),
}));

function makeWorkflow(stages?: Workflow["stages"]): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: stages ?? [{ id: "phases-stage", name: "Phases", order: 0 }],
		items: [],
		tools: [],
	};
}

function makeItem(overrides?: Partial<Item>): Item {
	return {
		id: "ITEM-1",
		description: "test",
		stage: "phases-stage",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function chainPhases(): StagePhases {
	return {
		initialState: "phase-a",
		states: {
			"phase-a": {
				id: "phase-a",
				label: "Phase A",
				description: "first",
				transitions: [{ target: "phase-b", auto: true }],
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

describe("canAutopilot", () => {
	it("AC9: returns true when current phase has auto transition", () => {
		const wf = makeWorkflow([
			{ id: "phases-stage", name: "Phases", order: 0, phases: chainPhases() as any },
		]);
		const item = makeItem({ currentPhase: "phase-a" });
		expect(canAutopilot(wf, item)).toBe(true);
	});

	it("returns false when current phase has no auto transition", () => {
		const wf = makeWorkflow([
			{ id: "phases-stage", name: "Phases", order: 0, phases: chainPhases() as any },
		]);
		const item = makeItem({ currentPhase: "phase-c" });
		expect(canAutopilot(wf, item)).toBe(false);
	});

	it("returns false when no current phase", () => {
		const wf = makeWorkflow();
		const item = makeItem({ currentPhase: undefined });
		expect(canAutopilot(wf, item)).toBe(false);
	});

	it("returns false when stage has no phases", () => {
		const wf = makeWorkflow();
		const item = makeItem({ stage: "backlog", currentPhase: undefined });
		expect(canAutopilot(wf, item)).toBe(false);
	});
});

describe("PhaseAutoPilot", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("AC2: run starts from current phase and follows auto chain", async () => {
		const wf = makeWorkflow([
			{ id: "phases-stage", name: "Phases", order: 0, phases: chainPhases() as any },
		]);
		const item = makeItem({ currentPhase: "phase-a" });
		const pilot = new PhaseAutoPilot();
		const result = await pilot.run("/fake/root", wf, item);
		expect(result.ok).toBe(true);
		expect(result.transitionsApplied).toBe(1);
		expect(item.currentPhase).toBe("phase-c");
	});

	it("AC4: stops when no auto transition on current phase", async () => {
		const wf = makeWorkflow([
			{ id: "phases-stage", name: "Phases", order: 0, phases: chainPhases() as any },
		]);
		const item = makeItem({ currentPhase: "phase-c" });
		const pilot = new PhaseAutoPilot();
		const result = await pilot.run("/fake/root", wf, item);
		expect(result.ok).toBe(true);
		expect(result.transitionsApplied).toBe(0);
		expect(result.finalPhase).toBe("phase-c");
	});

	it("AC7: auto transition to __EXIT__ clears currentPhase", async () => {
		const wf = makeWorkflow([
			{
				id: "exit-stage",
				name: "Exit",
				order: 0,
				phases: {
					initialState: "before-exit",
					states: {
						"before-exit": {
							id: "before-exit",
							label: "Before Exit",
							description: "d",
							transitions: [{ target: "__EXIT__", auto: true }],
							actions: [],
						},
					},
				} as any,
			},
		]);
		const item = makeItem({ stage: "exit-stage", currentPhase: "before-exit" });
		const pilot = new PhaseAutoPilot();
		const result = await pilot.run("/fake/root", wf, item);
		expect(result.ok).toBe(true);
		expect(result.finalPhase).toBeUndefined();
		expect(item.currentPhase).toBeUndefined();
		expect(result.transitionsApplied).toBe(1);
	});

	it("AC6: stops after MAX_AUTO_TRANSITIONS limit", async () => {
		const infinitePhases: StagePhases = {
			initialState: "loop-a",
			states: {
				"loop-a": {
					id: "loop-a",
					label: "Loop A",
					description: "d",
					transitions: [{ target: "loop-b", auto: true }],
					actions: [],
				},
				"loop-b": {
					id: "loop-b",
					label: "Loop B",
					description: "d",
					transitions: [{ target: "loop-a", auto: true }],
					actions: [],
				},
			},
		};
		const wf = makeWorkflow([
			{ id: "inf-stage", name: "Inf", order: 0, phases: infinitePhases as any },
		]);
		const item = makeItem({ stage: "inf-stage", currentPhase: "loop-a" });
		const pilot = new PhaseAutoPilot();
		const result = await pilot.run("/fake/root", wf, item);
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Auto-loop limit exceeded");
		expect(result.transitionsApplied).toBe(10);
	});

	it("AC8: logs each transition to session-log", async () => {
		const { logEntry } = await import("../session-log.js");
		const wf = makeWorkflow([
			{ id: "phases-stage", name: "Phases", order: 0, phases: chainPhases() as any },
		]);
		const item = makeItem({ currentPhase: "phase-a" });
		await autopilotRun("/fake/root", wf, item);
		expect(logEntry).toHaveBeenCalled();
		const calls = (logEntry as any).mock.calls;
		const systemCalls = calls.filter((c: any[]) => c[1] === "system");
		expect(systemCalls.length).toBeGreaterThanOrEqual(3);
	});

	it("AC5: stops and logs error when action fails", async () => {
		const failPhases: StagePhases = {
			initialState: "fail-phase",
			states: {
				"fail-phase": {
					id: "fail-phase",
					label: "Fail",
					description: "d",
					transitions: [{ target: "next-phase", auto: true }],
					actions: [{ type: "command", cmd: "exit 1" }],
				},
				"next-phase": {
					id: "next-phase",
					label: "Next",
					description: "d",
					transitions: [],
					actions: [],
				},
			},
		};
		const { execSync } = await import("node:child_process");
		(execSync as any).mockImplementationOnce(() => {
			throw new Error("Command failed: exit 1");
		});
		const wf = makeWorkflow([
			{ id: "fail-stage", name: "Fail", order: 0, phases: failPhases as any },
		]);
		const item = makeItem({ stage: "fail-stage", currentPhase: "fail-phase" });
		const pilot = new PhaseAutoPilot();
		const result = await pilot.run("/fake/root", wf, item);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Command failed");
		expect(result.transitionsApplied).toBe(0);
		expect(item.currentPhase).toBe("fail-phase");
	});

	it("AC3: executes actions before transitioning", async () => {
		const actionPhases: StagePhases = {
			initialState: "action-phase",
			states: {
				"action-phase": {
					id: "action-phase",
					label: "Action Phase",
					description: "d",
					transitions: [{ target: "done-phase", auto: true }],
					actions: [{ type: "agent-prompt", prompt: "do something" }],
				},
				"done-phase": {
					id: "done-phase",
					label: "Done",
					description: "d",
					transitions: [],
					actions: [],
				},
			},
		};
		const { writeFileSync } = await import("node:fs");
		const wf = makeWorkflow([
			{ id: "act-stage", name: "Act", order: 0, phases: actionPhases as any },
		]);
		const item = makeItem({ stage: "act-stage", currentPhase: "action-phase" });
		await autopilotRun("/fake/root", wf, item);
		expect(writeFileSync).toHaveBeenCalled();
		expect(item.currentPhase).toBe("done-phase");
	});
});
