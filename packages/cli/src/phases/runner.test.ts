import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Item } from "../commands/flow-init.js";
import { PhaseActionRunner } from "./runner.js";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(() => Buffer.from("ok")),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => true),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(() => ""),
}));

vi.mock("../session-log.js", () => ({
	logEntry: vi.fn(),
}));

function makeItem(overrides?: Partial<Item>) {
	return {
		id: "ITEM-1",
		description: "test",
		stage: "code-review",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as Item;
}

function makePhaseDef(overrides?: Record<string, unknown>) {
	return {
		id: "test-phase",
		label: "Test Phase",
		description: "A test phase",
		actions: [],
		transitions: [],
		harness: null,
		...overrides,
	};
}

describe("PhaseActionRunner", () => {
	let runner: PhaseActionRunner;

	beforeEach(() => {
		vi.clearAllMocks();
		runner = new PhaseActionRunner();
	});

	it("AC1: PhaseActionRunner is instantiable", () => {
		expect(runner).toBeInstanceOf(PhaseActionRunner);
	});

	it("AC2: execPhase returns ok when no actions", () => {
		const def = makePhaseDef({ actions: [] });
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		expect(result.actions).toEqual([]);
	});

	it("AC3: command action executes via execSync", async () => {
		const { execSync } = await import("node:child_process");
		const def = makePhaseDef({ actions: [{ type: "command", cmd: "npm run fix" }] });
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		expect(execSync).toHaveBeenCalledWith("npm run fix", expect.any(Object));
		expect(result.actions).toContain("command: npm run fix");
	});

	it("AC4: agent-prompt writes phase-prompt.md", async () => {
		const { writeFileSync } = await import("node:fs");
		const def = makePhaseDef({
			actions: [{ type: "agent-prompt", prompt: "Revise o diff" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		expect(writeFileSync).toHaveBeenCalled();
		const call = (writeFileSync as any).mock.calls.find((c: string[]) => c[0].includes("phase-prompt.md"));
		expect(call).toBeDefined();
		expect(call[1]).toContain("Revise o diff");
		expect(result.actions).toContain("agent-prompt: Revise o diff");
	});

	it("AC5: generate-report creates report file", async () => {
		const { writeFileSync } = await import("node:fs");
		const def = makePhaseDef({
			actions: [{ type: "generate-report", template: "review-report" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		const call = (writeFileSync as any).mock.calls.find((c: string[]) => c[0].includes("reports"));
		expect(call).toBeDefined();
		expect(result.actions).toContain("generate-report: review-report");
	});

	it("AC6: notify-human writes human-notify.md and logs", async () => {
		const { writeFileSync, existsSync } = await import("node:fs");
		const def = makePhaseDef({
			actions: [{ type: "notify-human", message: "Code ready for review" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		const call = (writeFileSync as any).mock.calls.find((c: string[]) => c[0].includes("human-notify.md"));
		expect(call).toBeDefined();
		expect(call[1]).toContain("Code ready for review");
		expect(result.actions).toContain("notify-human: Code ready for review");
	});

	it("AC7: wait-human checks gate and stops if not approved", async () => {
		const { readFileSync } = await import("node:fs");
		(readFileSync as any).mockReturnValue("blocking: true\nstatus: pending");
		const def = makePhaseDef({
			actions: [{ type: "wait-human", gate: "human-approved-code" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("not approved");
	});

	it("AC7b: wait-human passes if gate is approved", async () => {
		const { readFileSync } = await import("node:fs");
		(readFileSync as any).mockReturnValue("blocking: true\nstatus: approved");
		const def = makePhaseDef({
			actions: [{ type: "wait-human", gate: "human-approved-code" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		expect(result.actions).toContain("wait-human: human-approved-code (approved)");
	});

	it("AC9: failed action returns error and logs", async () => {
		const { execSync } = await import("node:child_process");
		(execSync as any).mockImplementationOnce(() => { throw new Error("Command failed"); });
		const def = makePhaseDef({
			actions: [{ type: "command", cmd: "failing-cmd" }],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Command failed");
	});

	it("AC2: runs multiple actions in sequence", () => {
		const def = makePhaseDef({
			actions: [
				{ type: "command", cmd: "cmd1" },
				{ type: "command", cmd: "cmd2" },
			],
		});
		const result = runner.execPhase("/root", makeItem(), def as any);
		expect(result.ok).toBe(true);
		expect(result.actions).toHaveLength(2);
	});

	it("AC9: item remains in phase after failure", async () => {
		const { execSync } = await import("node:child_process");
		(execSync as any).mockImplementationOnce(() => { throw new Error("fail"); });
		const item = makeItem({ currentPhase: "auto-review" });
		const def = makePhaseDef({
			actions: [{ type: "command", cmd: "fail" }],
		});
		const result = runner.execPhase("/root", item, def as any);
		expect(result.ok).toBe(false);
		expect(item.currentPhase).toBe("auto-review");
	});
});
