import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backlogAdd } from "../commands/flow-backlog.js";
import { init } from "../commands/init.js";
import { resolveLocalIdentity } from "../identity/service.js";
import { closeSessionLogHandles } from "../session-log.js";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { activateWorkOperation, claimOperation, directionForOperation } from "./service.js";

// ITEM-58 AC1: when the Run cannot be written after the item claim was, the
// item claim is undone instead of surviving without its Run.

const failRunWrite = { next: false };
vi.mock("../execution-runs/store.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("../execution-runs/store.js")>();
	return {
		...original,
		createExecutionRun: (...args: Parameters<typeof original.createExecutionRun>) => {
			if (failRunWrite.next) {
				failRunWrite.next = false;
				throw new Error("EPERM: simulated Run write failure");
			}
			return original.createExecutionRun(...args);
		},
	};
});

const roots: string[] = [];
let previousCwd: string;
beforeEach(() => {
	previousCwd = process.cwd();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
	process.chdir(previousCwd);
	vi.restoreAllMocks();
	closeSessionLogHandles();
	clearWorkspaceCache();
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("AC1 — a failed Run write undoes the item claim", () => {
	it("refuses with RUN_CLAIM_WRITE_FAILED and leaves the item unclaimed", async () => {
		const project = mkdtempSync(join(tmpdir(), "letra-claim-rollback-"));
		roots.push(project);
		process.chdir(project);
		await init(project, { workspace: `rollback-${Date.now()}`, yes: true, noTui: true });
		const workspaceDir = readFileSync(join(project, ".letra-link"), "utf8").trim();
		roots.push(workspaceDir);
		await backlogAdd(project, "Rollback");
		await activateWorkOperation(project, { itemId: "ITEM-1", actor: resolveLocalIdentity(project).id, reason: "teste", expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision });

		failRunWrite.next = true;
		const refusal = await claimOperation(project, { itemId: "ITEM-1", actor: "analyst", executorId: "codex", capability: "write_spec", reason: "teste", expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision });
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "RUN_CLAIM_WRITE_FAILED" });
		expect(refusal.reason).toContain("O claim do item foi desfeito");
		expect(refusal.nextCommand).toMatch(/^letra operation claim ITEM-1 /);

		const item = JSON.parse(readFileSync(join(workspaceDir, "workflow.json"), "utf8")).items[0];
		expect(item.claimedBy).toBeUndefined();

		// Repeating the command (as nextCommand says) now succeeds with a Run.
		const retry = await claimOperation(project, { itemId: "ITEM-1", actor: "analyst", executorId: "codex", capability: "write_spec", reason: "teste", expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision });
		expect(retry).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" });
		expect(retry.nextDirection.assignment).toMatchObject({ status: "assigned" });
	});
});
