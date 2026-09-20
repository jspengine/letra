import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createWorkflowDefinition,
	publishWorkflowDraft,
	createWorkflowDraft,
	updateWorkflowDraft,
} from "./service.js";
import { resolveActiveFlow, resolveActiveFlowFor } from "../flow-definition/resolve.js";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { claimOperation, requestTransitionOperation } from "../domain-operations/service.js";
import type { Workflow } from "../commands/flow-init.js";

describe("Gap 5: Runtime using active version and execution pin", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "letra-runtime-pin-test-"));
		mkdirSync(join(testDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("resolves the published active workflow version for the runtime", () => {
		const { definition, draft } = createWorkflowDefinition(testDir, {
			name: "Custom SDLC",
			actor: "human:supervisor",
			content: {
				name: "Custom SDLC",
				initialStageId: "stage-a",
				stages: [
					{ id: "stage-a", name: "Stage A", final: false, transitions: [{ target: "stage-b" }] },
					{ id: "stage-b", name: "Stage B", final: true },
				],
			},
		});

		publishWorkflowDraft(testDir, definition.id, {
			expectedRevision: draft.revision,
			actor: "human:supervisor",
			reason: "Initial release v1",
		});

		const resolution = resolveActiveFlow(testDir);
		expect(resolution.flow).not.toBeNull();
		expect(resolution.flow?.source).toBe("workflow-version");
		expect(resolution.flow?.workflowVersionNumber).toBe(1);
		expect(resolution.flow?.name).toBe("Custom SDLC");
		expect(resolution.flow?.stages.map((s) => s.id)).toEqual(["stage-a", "stage-b"]);
		expect(resolution.workflow?.stages.map((s) => s.id)).toEqual(["stage-a", "stage-b"]);
	});

	it("governs agent direction with the active published workflow version", () => {
		const { definition, draft } = createWorkflowDefinition(testDir, {
			name: "Direction Workflow",
			actor: "human:supervisor",
			content: {
				name: "Direction Workflow",
				initialStageId: "stage-one",
				stages: [
					{ id: "stage-one", name: "Stage One", zone: "doing", final: false, allow: ["implementer"], transitions: [{ target: "stage-two" }] },
					{ id: "stage-two", name: "Stage Two", zone: "done", final: true },
				],
			},
		});

		const published = publishWorkflowDraft(testDir, definition.id, {
			expectedRevision: draft.revision,
			actor: "human:supervisor",
			reason: "Release v1",
		});

		const workflow: Workflow = {
			version: "1.0",
			name: "Direction Workflow",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [
				{ id: "stage-one", name: "Stage One", order: 0, zone: "doing" },
				{ id: "stage-two", name: "Stage Two", order: 1, zone: "done" },
			],
			items: [
				{
					id: "ITEM-1",
					description: "Task 1",
					stage: "stage-one",
					createdAt: new Date().toISOString(),
				},
			],
			tools: [],
		};
		writeFileSync(join(testDir, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");

		const direction = resolveAgentDirection(testDir);
		expect(direction.source.workflowVersionId).toBe(published.id);
		expect(direction.source.workflowVersionNumber).toBe(1);
		expect(direction.item?.id).toBe("ITEM-1");
		expect(direction.item?.stage).toBe("stage-one");
		expect(direction.item?.workflowVersionId).toBe(published.id);
		expect(direction.item?.workflowVersionNumber).toBe(1);
	});

	it("preserves execution pin on items across subsequent workflow version publications", () => {
		// Create and publish v1
		const { definition, draft } = createWorkflowDefinition(testDir, {
			name: "Pinnable Flow",
			actor: "human:supervisor",
			content: {
				name: "Pinnable Flow v1",
				initialStageId: "alpha",
				stages: [
					{ id: "alpha", name: "Alpha", zone: "doing", final: false, allow: ["implementer"], transitions: [{ target: "omega" }] },
					{ id: "omega", name: "Omega", zone: "done", final: true },
				],
			},
		});

		const v1 = publishWorkflowDraft(testDir, definition.id, {
			expectedRevision: draft.revision,
			actor: "human:supervisor",
			reason: "Publish v1",
		});

		// Create and publish v2 with different stages
		const draft2 = createWorkflowDraft(testDir, definition.id, "human:supervisor");
		const updatedDraft2 = updateWorkflowDraft(testDir, definition.id, {
			expectedRevision: draft2.revision,
			actor: "human:supervisor",
			content: {
				name: "Pinnable Flow v2",
				initialStageId: "beta",
				stages: [
					{ id: "beta", name: "Beta", zone: "doing", final: false, allow: ["implementer"], transitions: [{ target: "gamma" }] },
					{ id: "gamma", name: "Gamma", zone: "done", final: true },
				],
			},
		});

		const v2 = publishWorkflowDraft(testDir, definition.id, {
			expectedRevision: updatedDraft2.revision,
			actor: "human:supervisor",
			reason: "Publish v2 with new stages",
		});

		// Workflow has ITEM-1 pinned to v1 and ITEM-2 unpinned
		const workflow: Workflow = {
			version: "1.0",
			name: "Pinnable Flow",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [],
			items: [
				{
					id: "ITEM-PINNED",
					description: "Pinned to v1",
					stage: "alpha",
					workflowVersionId: v1.id,
					workflowVersionNumber: 1,
					createdAt: new Date().toISOString(),
				},
				{
					id: "ITEM-NEW",
					description: "New item using active v2",
					stage: "beta",
					createdAt: new Date().toISOString(),
				},
			],
			tools: [],
		};
		writeFileSync(join(testDir, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");

		// Resolving direction for pinned item resolves v1
		const directionPinned = resolveAgentDirection(testDir, "ITEM-PINNED");
		expect(directionPinned.source.workflowVersionId).toBe(v1.id);
		expect(directionPinned.source.workflowVersionNumber).toBe(1);
		expect(directionPinned.item?.id).toBe("ITEM-PINNED");
		expect(directionPinned.item?.workflowVersionId).toBe(v1.id);

		// Resolving direction for unpinned new item resolves active v2
		const directionNew = resolveAgentDirection(testDir, "ITEM-NEW");
		expect(directionNew.source.workflowVersionId).toBe(v2.id);
		expect(directionNew.source.workflowVersionNumber).toBe(2);
		expect(directionNew.item?.id).toBe("ITEM-NEW");
		expect(directionNew.item?.workflowVersionId).toBe(v2.id);
	});

	it("pins workflowVersionId onto items during claim operation", async () => {
		const { definition, draft } = createWorkflowDefinition(testDir, {
			name: "Claim Pin Flow",
			actor: "human:supervisor",
			content: {
				name: "Claim Pin Flow",
				initialStageId: "work",
				stages: [
					{ id: "work", name: "Work", zone: "doing", final: false, allow: ["implementer"], transitions: [{ target: "done" }] },
					{ id: "done", name: "Done", zone: "done", final: true },
				],
			},
		});

		const published = publishWorkflowDraft(testDir, definition.id, {
			expectedRevision: draft.revision,
			actor: "human:supervisor",
			reason: "Publish v1",
		});

		const workflow: Workflow = {
			version: "1.0",
			name: "Claim Pin Flow",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [
				{ id: "work", name: "Work", order: 0, zone: "doing", allow: ["implementer"] },
				{ id: "done", name: "Done", order: 1, zone: "done" },
			],
			items: [
				{
					id: "ITEM-CLAIM",
					description: "Item to claim",
					stage: "work",
					createdAt: new Date().toISOString(),
				},
			],
			tools: [],
		};
		writeFileSync(join(testDir, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");

		const directionBefore = resolveAgentDirection(testDir);
		const claimResult = await claimOperation(testDir, {
			itemId: "ITEM-CLAIM",
			actor: "implementer",
			executorId: "codex",
			capability: "write_code",
			expectedRevision: directionBefore.revision,
			reason: "Starting work",
		});

		expect(claimResult.outcome).toBe("accepted");
		expect(claimResult.nextDirection.item?.workflowVersionId).toBe(published.id);
		expect(claimResult.nextDirection.item?.workflowVersionNumber).toBe(1);
	});
});
