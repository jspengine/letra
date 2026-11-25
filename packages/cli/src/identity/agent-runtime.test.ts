import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handoffItem } from "../commands/flow-handoff.js";
import operationCommand from "../commands/operation.js";
import { directionForOperation } from "../domain-operations/service.js";
import { closeSessionLogHandles, loadSessionLog } from "../session-log.js";
import { detectAgentRuntime, resolveCliActor } from "./agent-runtime.js";

// ITEM-51 (spec actor-real-na-auditoria): inside an agent, the CLI records the
// agent, never the local human, and human operations are refused.

const roots: string[] = [];
let previousEnv: Record<string, string | undefined>;
let previousExitCode: typeof process.exitCode;

beforeEach(() => {
	previousEnv = { AI_AGENT: process.env.AI_AGENT, CLAUDECODE: process.env.CLAUDECODE };
	previousExitCode = process.exitCode;
	process.exitCode = undefined;
});
afterEach(() => {
	for (const [key, value] of Object.entries(previousEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	process.exitCode = previousExitCode;
	vi.restoreAllMocks();
	closeSessionLogHandles();
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const asAgent = () => {
	process.env.AI_AGENT = "claude-code_2-1-330_agent";
	process.env.CLAUDECODE = "1";
};

function workspace(item: Record<string, unknown>): string {
	const root = mkdtempSync(join(tmpdir(), "letra-agent-actor-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "identity"), { recursive: true });
	writeFileSync(join(root, ".letra", "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test-host", createdAt: new Date().toISOString() }));
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
		version: "1.0", name: "Actors", createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z",
		stages: [{ id: "backlog", name: "Backlog", order: 0, zone: "todo" }, { id: "design", name: "Design", order: 1, zone: "doing" }],
		items: [{ id: "ITEM-1", description: "Actor subject", createdAt: "2026-11-25T00:00:00.000Z", ...item }],
		tools: [],
	}, null, 2));
	return root;
}

/** Runs `letra operation <args>` in the workspace and returns the printed result. */
async function operation(root: string, args: string[]): Promise<Record<string, unknown>> {
	const output: string[] = [];
	vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
		output.push(String(chunk));
		return true;
	});
	const cwd = process.cwd();
	try {
		process.chdir(root);
		await operationCommand().parseAsync(args, { from: "user" });
	} finally {
		process.chdir(cwd);
		vi.mocked(process.stdout.write).mockRestore();
	}
	return JSON.parse(output.join(""));
}

describe("AC1 — one detection of the agent runtime", () => {
	it.each([
		[{ AI_AGENT: "claude-code_2-1-330_agent" }, "claude-code"],
		[{ AI_AGENT: "Gemini-CLI" }, "gemini-cli"],
		[{ AI_AGENT: "___" }, "agent"],
		[{ CLAUDECODE: "1" }, "claude-code"],
		[{ CODEX_SANDBOX: "seatbelt" }, "codex"],
		[{ CURSOR_AGENT: "1" }, "cursor"],
	])("%o → %s", (env, runtime) => {
		expect(detectAgentRuntime(env)).toBe(runtime);
	});

	it("is null in a human terminal, including empty markers", () => {
		expect(detectAgentRuntime({})).toBeNull();
		expect(detectAgentRuntime({ AI_AGENT: " ", CLAUDECODE: "" })).toBeNull();
	});
});

describe("AC2 — the CLI records the agent as actor", () => {
	it("resolves agent:<runtime> and keeps an explicit role, but never an explicit human", () => {
		const env = { AI_AGENT: "claude-code_x" };
		expect(resolveCliActor("unused", undefined, env)).toBe("agent:claude-code");
		expect(resolveCliActor("unused", "reviewer", env)).toBe("reviewer");
		expect(resolveCliActor("unused", "human:owner", env)).toBe("agent:claude-code");
	});

	it("a handoff rollback run by an agent is audited as the agent", async () => {
		asAgent();
		const root = workspace({ stage: "design", claimedBy: "analyst", handoff: { from: "reviewer", to: "analyst", summary: "x", evidence: [], timestamp: "2026-11-25T00:00:00.000Z", expiresAt: "2026-11-25T00:30:00.000Z" } });
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		await handoffItem(root, "ITEM-1", { rollback: true });
		const rollback = loadSessionLog(root).entries.find((entry) => entry.details?.reasonCode === "HANDOFF_ROLLED_BACK");
		expect(rollback?.details?.by).toBe("agent:claude-code");
	});
});

describe("AC3 — human operations are refused inside an agent", () => {
	it("activation, even with --actor human:..., exits 1 with humanRequired", async () => {
		asAgent();
		const root = workspace({ stage: "backlog" });
		const revision = directionForOperation(root, { itemId: "ITEM-1" }).revision;
		const result = await operation(root, ["activate-work", "ITEM-1", "--actor", "human:owner", "--expected-revision", revision, "--reason", "Prioridade"]);
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "HUMAN_ACTOR_REQUIRED", humanRequired: true });
		expect(process.exitCode).toBe(1);
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].stage).toBe("backlog");
	});

	it("a gate decision is refused instead of crashing on the signature", async () => {
		asAgent();
		const root = workspace({ stage: "design" });
		const revision = directionForOperation(root, { itemId: "ITEM-1" }).revision;
		const result = await operation(root, ["gate-decision", "ITEM-1", "--decision", "approve", "--expected-revision", revision, "--reason", "Aprovado"]);
		expect(result).toMatchObject({ outcome: "rejected", humanRequired: true });
		expect(process.exitCode).toBe(1);
	});
});

describe("AC4 — a human terminal is unchanged", () => {
	it("uses the explicit actor, else the local human identity", () => {
		const root = workspace({ stage: "backlog" });
		expect(resolveCliActor(root, undefined, {})).toBe("human:owner");
		expect(resolveCliActor(root, "reviewer", {})).toBe("reviewer");
	});

	it("activation from a human terminal still works", async () => {
		const root = workspace({ stage: "backlog" });
		const revision = directionForOperation(root, { itemId: "ITEM-1" }).revision;
		const result = await operation(root, ["activate-work", "ITEM-1", "--expected-revision", revision, "--reason", "Prioridade"]);
		expect(result).toMatchObject({ reasonCode: expect.not.stringMatching(/HUMAN_ACTOR_REQUIRED/) });
	});
});
