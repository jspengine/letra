import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedFlowDefinition } from "@letra/types";
import type { Workflow } from "../commands/flow-init.js";
import { createAgentDirectionSnapshot, sealRevision } from "./service.js";

// Spec recusas-que-ensinam AC5: direction commands are ready to run.

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(): string {
	const dir = mkdtempSync(join(tmpdir(), "letra-direction-commands-"));
	roots.push(dir);
	mkdirSync(join(dir, ".letra"), { recursive: true });
	return dir;
}

const workflow = (): Workflow => ({
	version: "1.0", name: "Commands", createdAt: "2026-11-24T00:00:00.000Z", updatedAt: "2026-11-24T00:00:00.000Z",
	harnessVersion: "v1", template: "main",
	stages: [{ id: "security", name: "Security", order: 0 }, { id: "done", name: "Done", order: 1 }],
	items: [{ id: "ITEM-7", description: "Ready commands", stage: "security", spec: "commands", createdAt: "2026-11-24T00:00:00.000Z", claimedBy: "security", claimExecutorId: "codex", claimCapability: "security_scan" }],
	tools: [],
});

const role = { id: "security", label: "Security", description: "Scans", allowedStages: ["security"], capabilities: ["security_scan"] };

const flow = (): ResolvedFlowDefinition => ({
	id: "main", source: "workflow-template", harnessVersion: "v1", templateVersion: "1", name: "Main", warnings: [],
	roles: [role],
	operations: {
		security_review: { description: "Scan", requiredCapability: "security_scan", requiresClaim: true, allowedInStages: ["security"], allowedActors: [] },
		approve: { description: "Human approval", requiresClaim: false, allowedInStages: ["security"], allowedActors: [] },
		reclaim: { description: "Reclaim", requiresClaim: false, allowedInStages: ["*"], allowedActors: [] },
	},
	stages: [
		{
			id: "security", name: "Security", order: 0, roleIds: ["security"], roles: [role], agents: ["security"], gate: null, provenance: "harness",
			activity: {
				review: {
					objective: "Scan.",
					commands: [
						{ command: "letra flow handoff --to human --summary 'Security clear.'", label: "Handoff to Human" },
						{ command: "letra flow ac <ITEM-ID> <AC-NUMBER>", label: "Mark AC" },
						{ command: "letra flow phases <ITEM-ID>", label: "Phases" },
					],
				},
			},
		},
		{ id: "done", name: "Done", order: 1, roleIds: [], roles: [], agents: [], gate: null, provenance: "harness" },
	],
} as unknown as ResolvedFlowDefinition);

function snapshot(now = "2026-11-24T00:00:00.000Z", workspaceRoot = root()) {
	return createAgentDirectionSnapshot({
		workspaceRoot, workflow: workflow(), flow: flow(), currentItemId: "ITEM-7", now,
		specContent: "# Spec\n\n## Acceptance Criteria\n\n- [x] **AC1**: done\n- [ ] **AC2**: pending\n",
	});
}

describe("AC5 — direction commands are ready to run", () => {
	it("adds the item to harness commands that omit it and fills the AC number", () => {
		const commands = snapshot().commands.map((entry) => entry.command);
		expect(commands).toContain("letra flow handoff ITEM-7 --to human --summary 'Security clear.'");
		expect(commands).toContain("letra flow ac ITEM-7 2");
		expect(commands).toContain("letra flow phases ITEM-7");
	});

	it("points security_review to the real CLI command with item, executor and this direction's revision", () => {
		const direction = snapshot();
		const security = direction.operations?.find((operation) => operation.id === "security_review");
		expect(security?.command).toBe(`letra security review ITEM-7 --executor codex --expected-revision ${direction.revision} --reason "Revisao de Security escopada do ITEM-7"`);
	});

	it("flags human-only operations instead of handing the agent a command", () => {
		const approve = snapshot().operations?.find((operation) => operation.id === "approve");
		expect(approve).toMatchObject({ humanRequired: true });
		expect(approve?.command).toBeUndefined();
	});

	it("keeps the revision a function of content, not of the embedded revision", () => {
		const workspace = root();
		expect(snapshot("2026-11-24T00:00:00.000Z", workspace).revision).toBe(snapshot("2026-11-25T09:00:00.000Z", workspace).revision);
	});

	it("re-sealing after a semantic change embeds the new revision, never the old one", () => {
		const direction = snapshot();
		const { revision: _revision, generatedAt: _generatedAt, ...semantic } = direction;
		const resealed = sealRevision({ ...semantic, assignment: { status: "assigned" as const, runId: "run-1" } });
		expect(resealed.revision).not.toBe(direction.revision);
		const command = resealed.operations?.find((operation) => operation.id === "security_review")?.command;
		expect(command).toContain(`--expected-revision ${resealed.revision}`);
		expect(command).not.toContain(direction.revision);
	});
});
