import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDirection } from "../agent-direction/service.js";
import { activateWorkOperation, directionForOperation } from "../domain-operations/service.js";
import { resolveLocalIdentity } from "../identity/service.js";
import { closeSessionLogHandles } from "../session-log.js";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { backlogAdd } from "./flow-backlog.js";
import { init } from "./init.js";

// ITEM-16 (spec init-harness-regressao): a workspace created by `letra init
// --workspace` resolves the template's harness. Reported as HARNESS_UNAVAILABLE
// in an earlier version; not reproducible in 0.8.0, kept as a regression test.

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

describe("AC1 — a new workspace resolves its harness", () => {
	it("has no HARNESS_UNAVAILABLE and activates an item", async () => {
		const project = mkdtempSync(join(tmpdir(), "letra-init-harness-"));
		roots.push(project);
		process.chdir(project);
		await init(project, { workspace: `harness-${Date.now()}`, yes: true, noTui: true });
		roots.push(readFileSync(join(project, ".letra-link"), "utf8").trim());

		await backlogAdd(project, "Primeira tarefa");
		const direction = resolveDirection(project, { itemId: "ITEM-1" });
		expect(direction.source.harnessVersion).toBeTruthy();
		expect(direction.warnings.map((warning) => warning.code)).not.toContain("HARNESS_UNAVAILABLE");

		const activated = await activateWorkOperation(project, {
			itemId: "ITEM-1",
			actor: resolveLocalIdentity(project).id,
			reason: "Regressão do ITEM-16",
			expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision,
		});
		expect(activated).toMatchObject({ outcome: "accepted", reasonCode: "WORK_ACTIVATED" });
	});
});
