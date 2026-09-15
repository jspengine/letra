import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCodexExecutor } from "./codex-executor.js";
import { PersistentDispatcher, type DispatcherOperations } from "./dispatcher.js";

const roots: string[] = [];

function gitWorkspace(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-codex-process-"));
	roots.push(root);
	execFileSync("git", ["init", root], { stdio: "ignore" });
	return root;
}

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("Codex executor process invocation", () => {
	it.skipIf(process.platform !== "win32")("starts the real Codex adapter through the dispatcher in the selected Git workspace", async () => {
		const root = gitWorkspace();
		const shim = join(root, "fake-codex.cmd");
		const cwdFile = join(root, "codex-cwd.txt");
		const argsFile = join(root, "codex-args.txt");
		writeFileSync(shim, [
			"@echo off",
			`echo %CD%>\"${cwdFile}\"`,
			`echo %*>\"${argsFile}\"`,
			"echo {\"type\":\"agent_message\",\"item\":{\"type\":\"agent_message\",\"text\":\"executor-ok\"}}",
			"exit /b 0",
		].join("\r\n"));
		const executor = createCodexExecutor({ root, command: shim, model: "test-model", timeoutMs: 5_000, capabilities: ["write_code"] });
		const workflow = {
			version: "1", name: "Codex process", createdAt: "", updatedAt: "", tools: [],
			stages: [
				{ id: "code", name: "Code", order: 1, agents: ["implementer"] },
				{ id: "review", name: "Review", order: 2, agents: ["reviewer"] },
			],
			items: [{ id: "ITEM-82", description: "", stage: "code", createdAt: "", handoff: { from: "human:owner", to: "implementer", summary: "Start", evidence: [], timestamp: "", expiresAt: "" } }],
		} as any;
		const events: string[] = [];
		const direction = () => ({ revision: "process-revision", item: workflow.items[0] } as any);
		const accepted = () => ({ outcome: "accepted" as const, afterRevision: "process-revision", reasonCode: "OK", reason: "ok", nextDirection: direction() });
		const operations = {
			getDirection: direction,
			claim: async ({ executorId, actor, capability }: any) => { Object.assign(workflow.items[0], { claimedBy: actor, claimExecutorId: executorId, claimCapability: capability }); return accepted(); },
			event: async ({ status }: any) => { events.push(status); workflow.items[0].activityStatus = status; return accepted(); },
			evidence: async () => accepted(),
			validate: async () => accepted(),
			transition: async ({ targetStageId }: any) => { workflow.items[0].stage = targetStageId; return accepted(); },
			handoff: async ({ to, executorId, summary, evidence }: any) => { Object.assign(workflow.items[0], { claimedBy: undefined, claimExecutorId: undefined, handoff: { from: "codex", to, executorId, summary, evidence, timestamp: "", expiresAt: "" } }); return accepted(); },
			release: async () => accepted(),
		} satisfies DispatcherOperations;
		const result = await new PersistentDispatcher(
			{ loadWorkflow: () => workflow, operations },
			() => [executor],
			30_000,
			{
				stageActors: (stageId) => workflow.stages.find((stage: any) => stage.id === stageId)?.agents ?? [],
				stageCapability: () => "write_code",
				resolveExecutionWorkspace: () => ({ ok: true, root }),
			},
		).dispatch();
		expect(result).toEqual([{ itemId: "ITEM-82", status: "dispatched" }]);
		expect(workflow.items[0]).toMatchObject({ stage: "review", handoff: { to: "reviewer" } });
		expect(events).toEqual(expect.arrayContaining(["started", "succeeded"]));
		expect(events).not.toContain("failed");
		expect(readFileSync(cwdFile, "utf8").trim().replace(/\\/g, "/").toLowerCase()).toBe(root.replace(/\\/g, "/").toLowerCase());
		const args = readFileSync(argsFile, "utf8").trim().replace(/\\/g, "/");
		expect(args).toContain("-C");
		expect(args.indexOf("-C")).toBeLessThan(args.indexOf("exec"));
		expect(args).toContain(root.replace(/\\/g, "/"));
	});
});
