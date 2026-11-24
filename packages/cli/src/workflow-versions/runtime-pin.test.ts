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
import { claimOperation, directionForOperation, recordExecutionEvent, releaseClaimOperation, requestHandoffOperation, requestTransitionOperation } from "../domain-operations/service.js";
import { readExecutionRuns } from "../execution-runs/store.js";
import type { Workflow } from "../commands/flow-init.js";

describe("Gap 5: Runtime using active version and execution pin", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "letra-runtime-pin-test-"));
		mkdirSync(join(testDir, ".letra", "identity"), { recursive: true });
		writeFileSync(join(testDir, ".letra", "identity", "local.json"), JSON.stringify({ id: "human:supervisor", osUser: "supervisor", hostname: "test-host", createdAt: new Date().toISOString() }));
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

		const direction = resolveAgentDirection(testDir, "ITEM-1");
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
					{ id: "work", name: "Work", zone: "doing", final: false, allow: ["implementer", "reviewer"], transitions: [{ target: "done" }] },
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

		const directionBefore = resolveAgentDirection(testDir, "ITEM-CLAIM");
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
		const createdRun = readExecutionRuns(testDir).runs[0];
		expect(createdRun).toMatchObject({ itemId: "ITEM-CLAIM", workflowVersionId: published.id, status: "running", binding: { executorId: "codex" }, authorization: { kind: "claim" } });

		const handoff = await requestHandoffOperation(testDir, {
			itemId: "ITEM-CLAIM", to: "reviewer", summary: "Implementation ready", evidence: ["tests passed"],
			executorId: "codex", actor: "implementer", expectedRevision: claimResult.afterRevision,
			reason: "Transfer the pinned Run for review.",
		});
		// Handoff is the canonical passage (requestHandoffOperation delegates to
		// requestPassageOperation); a role recipient completes the passage.
		expect(handoff).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
		// A passage to a role queues the Run for that role ("waiting-human" is
		// for human recipients); same contract as domain-operations/service.test.
		const waitingRun = readExecutionRuns(testDir).runs[0];
		expect(waitingRun).toMatchObject({ id: createdRun?.id, status: "queued", lease: null, cycle: { endedAt: expect.any(String) } });
		expect(waitingRun?.handoffs[0]?.toActorId).toBe("reviewer");

		const resumed = await claimOperation(testDir, {
			itemId: "ITEM-CLAIM", actor: "reviewer", executorId: "codex", capability: "review_code",
			expectedRevision: handoff.afterRevision, reason: "Accept the handoff in a new execution cycle.",
		});
		expect(resumed.outcome).toBe("accepted");
		expect(readExecutionRuns(testDir).runs[0]).toMatchObject({ id: createdRun?.id, status: "running", workflowVersionId: published.id, revision: 3, cycle: { number: 2, endedAt: null }, binding: { actorId: "reviewer", executorId: "codex" }, authorization: { kind: "handoff" } });
		// Events and release compare directionForOperation, while the claim
		// returns the assigned Run direction as afterRevision; chaining them
		// directly is ITEM-39. Consult the direction the operation compares,
		// as the product dispatcher does before each call.
		const heartbeat = await recordExecutionEvent(testDir, {
			itemId: "ITEM-CLAIM", actor: "reviewer", executorId: "codex", status: "heartbeat",
			expectedRevision: directionForOperation(testDir, { itemId: "ITEM-CLAIM" }).revision,
			reason: "Renew the delegated Run lease.",
		});
		expect(heartbeat).toMatchObject({ outcome: "accepted", reasonCode: "EVENT_RECORDED" });
		expect(readExecutionRuns(testDir).runs[0]?.lease?.heartbeatAt).toBeTruthy();
		const released = await releaseClaimOperation(testDir, {
			itemId: "ITEM-CLAIM", actor: "reviewer",
			expectedRevision: directionForOperation(testDir, { itemId: "ITEM-CLAIM" }).revision,
			reason: "Release the completed Run cycle.",
		});
		expect(released).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_RELEASED" });
		expect(readExecutionRuns(testDir).runs[0]).toMatchObject({ status: "completed", lease: null, result: { outcome: "cancelled" } });
	});
});
