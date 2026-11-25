import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init } from "../commands/init.js";
import { saveWorkflow } from "../commands/flow-init.js";
import {
	activateWorkOperation,
	claimOperation,
	directionForOperation,
	linkItemSpecOperation,
} from "../domain-operations/service.js";
import { resolveDirection } from "../agent-direction/service.js";
import { closeSessionLogHandles } from "../session-log.js";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { PUBLISH_INITIAL_VERSION_COMMAND, publishInitialWorkflowVersion } from "./bootstrap.js";
import { listWorkflowDefinitions } from "./service.js";

// ITEM-35 (spec init-publica-workflow): a new workspace can run the agent flow.

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

/** A project initialised with `letra init --workspace`, as a new user would. */
async function newWorkspace(): Promise<{ project: string; workspaceDir: string }> {
	const project = mkdtempSync(join(tmpdir(), "letra-init-version-"));
	roots.push(project);
	process.chdir(project);
	await init(project, { workspace: `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`, yes: true, noTui: true });
	const workspaceDir = readFileSync(join(project, ".letra-link"), "utf8").trim();
	roots.push(workspaceDir);
	return { project, workspaceDir };
}

describe("AC1 — init publishes version 1", () => {
	it("creates and publishes the template workflow on init --workspace", async () => {
		const { workspaceDir } = await newWorkspace();
		const definitions = listWorkflowDefinitions(workspaceDir);
		expect(definitions).toHaveLength(1);
		expect(definitions[0]?.activeVersionId).toBeTruthy();
	});

	it("never touches a workspace that already has a versioned workflow", async () => {
		const { workspaceDir } = await newWorkspace();
		expect(publishInitialWorkflowVersion(workspaceDir, "human:owner")).toEqual({ status: "skipped", reason: "already-versioned" });
		expect(listWorkflowDefinitions(workspaceDir)).toHaveLength(1);
	});
});

describe("AC2/AC3 — Run on claim and linkable spec in a new workspace", () => {
	it("activation, claim and link-item-spec work end to end", async () => {
		const { project } = await newWorkspace();
		const { backlogAdd } = await import("../commands/flow-backlog.js");
		await backlogAdd(project, "Primeira tarefa");
		const identity = (await import("../identity/service.js")).resolveLocalIdentity(project).id;
		const activated = await activateWorkOperation(project, { itemId: "ITEM-1", actor: identity, reason: "teste", expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision });
		expect(activated).toMatchObject({ outcome: "accepted", reasonCode: "WORK_ACTIVATED" });

		const claim = await claimOperation(project, { itemId: "ITEM-1", actor: "analyst", executorId: "codex", capability: "write_spec", reason: "teste", expectedRevision: directionForOperation(project, { itemId: "ITEM-1" }).revision });
		expect(claim).toMatchObject({ outcome: "accepted" });
		const direction = resolveDirection(project, { itemId: "ITEM-1" });
		expect(direction.assignment).toMatchObject({ status: "assigned" });
		expect(direction.mode).toBe("active");

		const specDir = join(readFileSync(join(project, ".letra-link"), "utf8").trim(), "specs", "primeira");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(join(specDir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n\n- [ ] **AC1**: x\n");
		const linked = await linkItemSpecOperation(project, { itemId: "ITEM-1", specId: "primeira", runId: direction.run?.id ?? "", executorId: "codex", actor: "analyst", reason: "teste", expectedRevision: direction.revision });
		expect(linked).toMatchObject({ outcome: "accepted", reasonCode: "SPEC_LINKED" });
	});
});

describe("AC4 — refusal names the unpublished workflow", () => {
	it("ACTIVE_RUN_REQUIRED points to publish-initial with humanRequired", async () => {
		const root = mkdtempSync(join(tmpdir(), "letra-unversioned-"));
		roots.push(root);
		mkdirSync(join(root, ".letra", "identity"), { recursive: true });
		saveWorkflow(root, {
			version: "1.0", name: "Unversioned", createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z",
			stages: [{ id: "design", name: "Design", order: 0 }],
			items: [{ id: "ITEM-1", description: "x", stage: "design", createdAt: "2026-11-25T00:00:00.000Z" }],
			tools: [],
		});
		const refusal = await linkItemSpecOperation(root, { itemId: "ITEM-1", specId: "x", runId: "run-none", executorId: "codex", actor: "analyst", reason: "teste", expectedRevision: directionForOperation(root, { itemId: "ITEM-1" }).revision });
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "ACTIVE_RUN_REQUIRED", nextCommand: PUBLISH_INITIAL_VERSION_COMMAND, humanRequired: true });
		expect(refusal.reason).toContain("não tem versão de workflow publicada");
	});
});
