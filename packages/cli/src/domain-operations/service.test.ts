import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { getLetraDir } from "../workspace/resolver.js";
import { loadSessionLog } from "../session-log.js";
import {
	completeAcOperation,
	activateWorkOperation,
	createItemOperation,
	updateItemOperation,
	requestHandoffOperation,
	rollbackHandoffOperation,
	requestPassageOperation,
	requestTransitionOperation,
	requestReworkOperation,
	runValidationOperation,
	claimOperation,
	recordExecutionEvent,
	runSecurityReviewOperation,
	decideGateOperation,
	migrateRunWorkflowOperation,
} from "./service.js";
import operationCommand from "../commands/operation.js";
import { signLocalOperation } from "../identity/signing.js";
import { createExecutionRun, readExecutionRuns, updateExecutionRun } from "../execution-runs/store.js";
import { createWorkflowDefinition, createWorkflowDraft, publishWorkflowDraft, updateWorkflowDraft } from "../workflow-versions/service.js";
import { commitWorkspaceTransaction, setWorkspaceTransactionFailureInjectorForTests } from "./workspace-transaction.js";
import { createHash, randomUUID } from "node:crypto";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-domain-operation-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "controlled-operation"), { recursive: true });
	mkdirSync(join(root, ".letra", "identity"), { recursive: true });
	writeFileSync(join(root, ".letra", "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test-host", createdAt: new Date().toISOString() }));
	writeFileSync(
		join(root, ".letra", "workflow.json"),
		JSON.stringify(
			{
				version: "1.0",
				name: "Controlled operations",
				createdAt: "2026-07-04T00:00:00.000Z",
				updatedAt: "2026-07-04T00:00:00.000Z",
				stages: [
					{ id: "code", name: "Code", order: 0, zone: "doing" },
					{ id: "review", name: "Review", order: 1, zone: "doing" },
				],
				items: [
					{
						id: "ITEM-1",
						description: "Controlled operation",
						stage: "code",
						spec: "controlled-operation",
						createdAt: "2026-07-04T00:00:00.000Z",
					},
				],
				primaryItemId: "ITEM-1",
				tools: [],
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(root, ".letra", "specs", "controlled-operation", "spec.md"),
		"# Spec\n\n## Outcome\n\nControlled operation with enough detail for validation.\n\n" +
			"## Acceptance Criteria\n\n- [ ] **AC1**: operation is controlled\n",
	);
	return root;
}

function configureHarness(root: string, codeGate?: string): void {
	const workflowPath = join(root, ".letra", "workflow.json");
	const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
	workflow.template = "controlled-flow";
	workflow.harnessVersion = "v0.2.0";
	workflow.stages[0].allow = ["review"];
	writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
	const harness = join(root, ".letra", "harness", "v0.2.0");
	mkdirSync(join(harness, "flows"), { recursive: true });
	mkdirSync(join(harness, "gates"), { recursive: true });
	mkdirSync(join(harness, "roles"), { recursive: true });
	writeFileSync(
		join(harness, "flows", "controlled-flow.yaml"),
		[
			"id: controlled-flow",
			"version: 1.0.0",
			"name: Controlled Flow",
			"description: test",
			"defaultPolicy: default",
			"stages:",
			"  - id: code",
			"    name: Code",
			"    order: 0",
			"    zone: doing",
			"    agents: [\"implementer\"]",
			"    transitions:",
			"      - target: review",
			...(codeGate ? [`    gate: gates/${codeGate}.yaml`] : []),
			"  - id: review",
			"    name: Review",
			"    order: 1",
			"    zone: doing",
			"    agents: [\"reviewer\"]",
			"    rework:",
			"      target: code",
			"      allowed_actors: [\"reviewer\"]",
			"      create_ac: true",
		].join("\n"),
	);
}

function configurePassageRuntimeBindings(root: string, includeDestination = true, destinationIdentityId = "reviewer"): void {
	const harnessRoot = join(root, ".letra", "harness", "v0.2.0");
	mkdirSync(join(harnessRoot, "executors"), { recursive: true });
	writeFileSync(join(harnessRoot, "executors", "registry.yaml"), [
		"executors:",
		"  - id: codex",
		"    label: Codex",
		"    capabilities:",
		"      - code",
		"      - review",
		"    priority: 1",
		"  - id: opencode",
		"    label: OpenCode",
		"    capabilities:",
		"      - code",
		"      - review",
		"    priority: 2",
		"stageExecutorPreferences:",
		"  code:",
		"    - codex",
		"  review:",
		"    - opencode",
		"    - codex",
	].join("\n"));
	writeFileSync(join(root, ".letra", "agents.json"), JSON.stringify({
		version: "1",
		updatedAt: new Date().toISOString(),
		agents: [
			{ id: "implementer", displayName: "Implementer", role: "implementer", roleIds: ["implementer"], bio: "", avatar: { type: "initials", value: "IM" }, color: "blue", skills: [], status: "offline", stageBindings: ["code"], adapterHints: {} },
			{ id: destinationIdentityId, displayName: "Reviewer", role: "reviewer", roleIds: ["reviewer"], bio: "", avatar: { type: "initials", value: "RV" }, color: "blue", skills: [], status: "offline", stageBindings: ["review"], adapterHints: {} },
		],
		runtimeBindings: [
			{ version: "1", id: "implementer:implementer:codex", identityId: "implementer", roleId: "implementer", executorId: "codex", capabilities: ["read_code", "write_code", "run_tests"], stageIds: ["code"], availability: "online-required", harnessVersion: "v0.2.0" },
			...(includeDestination ? [
				{ version: "1", id: `${destinationIdentityId}:reviewer:opencode`, identityId: destinationIdentityId, roleId: "reviewer", executorId: "opencode", capabilities: ["read_code", "review_code", "run_tests"], stageIds: ["review"], availability: "online-required", harnessVersion: "v0.2.0" },
				{ version: "1", id: `${destinationIdentityId}:reviewer:codex`, identityId: destinationIdentityId, roleId: "reviewer", executorId: "codex", capabilities: ["read_code", "review_code", "run_tests"], stageIds: ["review"], availability: "online-required", harnessVersion: "v0.2.0" },
			] : []),
		],
	}, null, 2));
}

function authorizedPassageFixture(
	claim: { actor?: string; capability?: string } = {},
	options: { operations?: Record<string, unknown>; includeDestination?: boolean; destinationIdentityId?: string } = {},
) {
	const root = fixture();
	configureHarness(root);
	configurePassageRuntimeBindings(root, options.includeDestination !== false, options.destinationIdentityId);
	const created = createWorkflowDefinition(root, {
		name: "Role-separated passage",
		actor: "human:owner",
		content: {
			name: "Role-separated passage",
			operations: options.operations,
			initialStageId: "code",
			stages: [
				{ id: "code", allow: ["implementer"], transitions: [{ target: "review" }] },
				{ id: "review", allow: ["reviewer"], preferredExecutor: "opencode", transitions: [{ target: "done" }] },
				{ id: "done", allow: ["reviewer"], final: true },
			],
		},
	});
	const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Publish role-separated passage." });
	const rolesRoot = join(root, ".letra", "harness", "v0.2.0", "roles");
	writeFileSync(join(rolesRoot, "implementer.yaml"), "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - read_code\n  - write_code\n  - run_tests\n");
	writeFileSync(join(rolesRoot, "reviewer.yaml"), "id: reviewer\nlabel: Reviewer\nallowedStages:\n  - review\ncapabilities:\n  - read_code\n  - review_code\n  - run_tests\n");
	const workflowPath = join(root, ".letra", "workflow.json");
	const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
	Object.assign(workflow.items[0], {
		workflowVersionId: published.id,
		workflowVersionNumber: published.number,
		claimedBy: claim.actor ?? "implementer",
		claimExecutorId: "codex",
		claimCapability: claim.capability ?? "write_code",
		claimRevision: "sha256:claim",
		claimExpiresAt: new Date(Date.now() + 60_000).toISOString(),
		claimTtlMinutes: 30,
	});
	writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
	const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
	writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1", "- [x] **AC1"));
	const before = resolveAgentDirection(root, "ITEM-1");
	return {
		root,
		workflowId: created.definition.id,
		pinnedVersionId: published.id,
		input: {
			itemId: "ITEM-1",
			targetStageId: "review",
			to: "reviewer",
			actor: claim.actor ?? "implementer",
			executorId: "codex",
			summary: "Ready for review",
			evidence: ["tests passed"],
			expectedRevision: before.revision,
			reason: "Implementation is complete.",
		},
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("domain operations", () => {
	it("authorizes the source role independently from an eligible destination role", () => {
		const { root, input } = authorizedPassageFixture();

		expect(readExecutionRuns(root).runs).toHaveLength(0);
		expect(requestPassageOperation(root, input)).toMatchObject({
			outcome: "accepted",
			reasonCode: "PASSAGE_COMPLETED",
			nextDirection: { item: { stage: "review" } },
		});
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].handoff).toMatchObject({ executorId: "codex", targetExecutorId: "opencode" });
		expect(readExecutionRuns(root).runs).toHaveLength(0);
	});

	it("allows only the selected destination executor to claim a passage from a different source executor", async () => {
		const { root, input } = authorizedPassageFixture();
		const passage = requestPassageOperation(root, input);
		expect(passage).toMatchObject({ outcome: "accepted", nextDirection: { item: { stage: "review" } } });
		const claimRoot = fixture();
		configureHarness(claimRoot);
		const workflowPath = join(root, ".letra", "workflow.json");
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8"));
		expect(persisted.items[0].handoff).toMatchObject({ executorId: "codex", targetExecutorId: "opencode" });
		const claimWorkflowPath = join(claimRoot, ".letra", "workflow.json");
		const claimWorkflow = JSON.parse(readFileSync(claimWorkflowPath, "utf8"));
		claimWorkflow.items[0].handoff = {
			from: "implementer", to: "reviewer", summary: "Passage from codex to opencode.", evidence: ["tests passed"],
			timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
			executorId: "codex", targetExecutorId: "opencode",
		};
		writeFileSync(claimWorkflowPath, JSON.stringify(claimWorkflow, null, 2));
		const anotherRole = await claimOperation(claimRoot, {
			itemId: "ITEM-1", actor: "implementer", executorId: "codex", capability: "write_code",
			expectedRevision: resolveAgentDirection(claimRoot, "ITEM-1").revision, reason: "A different eligible stage role cannot consume the active handoff.",
		});
		expect(anotherRole).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });

		const destinationClaim = await claimOperation(claimRoot, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "opencode", capability: "review_code",
			expectedRevision: resolveAgentDirection(claimRoot, "ITEM-1").revision, reason: "Accept passage on the selected destination executor.",
		});
		expect(destinationClaim).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED", nextDirection: { item: { claimExecutorId: "opencode" } } });

		const claimed = JSON.parse(readFileSync(claimWorkflowPath, "utf8"));
		claimed.items[0].claimedBy = undefined;
		claimed.items[0].claimExecutorId = undefined;
		claimed.items[0].claimExpiresAt = undefined;
		writeFileSync(claimWorkflowPath, JSON.stringify(claimed, null, 2));
		const sourceRetry = await claimOperation(claimRoot, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "codex", capability: "review_code",
			expectedRevision: resolveAgentDirection(claimRoot, "ITEM-1").revision, reason: "The source executor cannot consume the destination handoff.",
		});
		expect(sourceRetry).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });
	});

	it("preserves the selected destination identity when identityId differs from the role", async () => {
		const { root, input } = authorizedPassageFixture({}, { destinationIdentityId: "reviewer-instance" });
		const passage = requestPassageOperation(root, input);
		expect(passage).toMatchObject({ outcome: "accepted", nextDirection: { item: { stage: "review" } } });
		const workflowPath = join(root, ".letra", "workflow.json");
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].handoff).toMatchObject({ to: "reviewer", targetExecutorId: "opencode", targetIdentityId: "reviewer-instance" });

		const claim = await claimOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "opencode", capability: "review_code",
			expectedRevision: passage.nextDirection!.revision, reason: "Claim with the identity bound to the passage.",
		});
		expect(claim).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" });
		expect(readExecutionRuns(root).runs[0].binding).toMatchObject({ actorId: "reviewer", roleId: "reviewer", identityId: "reviewer-instance", executorId: "opencode" });
	});

	it("rejects the passage when the destination role has no compatible configured executor binding", () => {
		const { root, input } = authorizedPassageFixture({}, { includeDestination: false });

		expect(requestPassageOperation(root, input)).toMatchObject({ outcome: "rejected", reasonCode: "DESTINATION_EXECUTOR_NOT_ELIGIBLE" });
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].stage).toBe("code");
	});

	it("chooses a destination executor from the item-pinned workflow version", () => {
		const { root, input, workflowId, pinnedVersionId } = authorizedPassageFixture();
		const draft = createWorkflowDraft(root, workflowId, "human:owner");
		const latestContent = structuredClone(draft.content);
		latestContent.stages.find((stage) => stage.id === "review")!.preferredExecutor = "codex";
		updateWorkflowDraft(root, workflowId, { expectedRevision: draft.revision, actor: "human:owner", content: latestContent });
		publishWorkflowDraft(root, workflowId, { expectedRevision: draft.revision + 1, actor: "human:owner", reason: "Change the active version executor preference." });
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].workflowVersionId).toBe(pinnedVersionId);

		const passage = requestPassageOperation(root, input);
		expect(passage).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].handoff).toMatchObject({ targetExecutorId: "opencode" });
	});

	it("enforces configured handoff actors and required capabilities", () => {
		const actorRestricted = authorizedPassageFixture({}, { operations: { handoff: { requiresClaim: true, allowedInStages: ["*"], allowedActors: ["reviewer"] } } });
		expect(requestPassageOperation(actorRestricted.root, actorRestricted.input)).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });

		const capabilityRestricted = authorizedPassageFixture({}, { operations: { handoff: { requiresClaim: true, requiredCapability: "review_code", allowedInStages: ["*"], allowedActors: [] } } });
		expect(requestPassageOperation(capabilityRestricted.root, capabilityRestricted.input)).toMatchObject({ outcome: "rejected", reasonCode: "CAPABILITY_INVALID" });
	});

	it("rejects a source actor that is not assigned to the current stage", () => {
		const { root, input } = authorizedPassageFixture({ actor: "reviewer" });

		expect(requestPassageOperation(root, input)).toMatchObject({
			outcome: "rejected",
			reasonCode: "ACTOR_NOT_ALLOWED",
		});
	});

	it("rejects a source claim capability that the current role does not have", () => {
		const { root, input } = authorizedPassageFixture({ capability: "security_scan" });

		expect(requestPassageOperation(root, input)).toMatchObject({
			outcome: "rejected",
			reasonCode: "CAPABILITY_INVALID",
		});
	});

	it("rejects a destination actor that is not assigned to the target stage", () => {
		const { root, input } = authorizedPassageFixture();

		expect(requestPassageOperation(root, { ...input, to: "implementer" })).toMatchObject({
			outcome: "rejected",
			reasonCode: "DESTINATION_ACTOR_NOT_ALLOWED",
		});
	});

	it("rejects a source Run whose binding does not match the authorized workflow actor", () => {
		const { root, input } = authorizedPassageFixture();
		const workflow = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8"));
		const now = new Date().toISOString();
		const runId = "run-wrong-source-binding";
		createExecutionRun(root, {
			id: runId,
			workspaceId: root,
			itemId: "ITEM-1",
			binding: { actorId: "reviewer", identityId: "reviewer", roleId: "reviewer", executorId: "codex" },
			authorization: { kind: "manual", actorId: "human:owner", referenceId: "fixture", grantedAt: now, revision: "sha256:fixture" },
			workflowVersionId: workflow.items[0].workflowVersionId,
			workflowStageId: "code",
			cycle: { number: 1, startedAt: now, endedAt: null },
			lease: null,
			revision: 1,
			directionRevision: "sha256:fixture",
			createdAt: now,
			updatedAt: now,
			result: null,
			handoffs: [],
			gateDecisions: [],
			evidence: [],
			status: "running",
		});
		input.expectedRevision = resolveAgentDirection(root, undefined, { runId }).revision;

		expect(requestPassageOperation(root, input)).toMatchObject({
			outcome: "rejected",
			reasonCode: "RUN_BINDING_MISMATCH",
		});
	});

	it("routes transitions through the item's pinned version and its configured arbitrary edges", async () => {
		const root = fixture();
		configureHarness(root);
		const created = createWorkflowDefinition(root, {
			name: "Arbitrary stages",
			actor: "human:owner",
			content: {
				name: "Arbitrary stages",
				initialStageId: "intake",
				stages: [
					{ id: "intake", order: 0, transitions: [{ target: "compile" }] },
					{ id: "compile", order: 1, transitions: [{ target: "publish" }, { target: "unconfigured" }] },
					{ id: "unconfigured", order: 2, transitions: [{ target: "publish" }] },
					{ id: "publish", order: 3, final: true },
				],
			},
		});
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Pin arbitrary workflow." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.items[0].stage = "intake";
		workflow.items[0].spec = undefined;
		workflow.items[0].workflowVersionId = published.id;
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

		const before = resolveAgentDirection(root, "ITEM-1");
		const blocked = await requestTransitionOperation(root, {
			itemId: "ITEM-1", targetStageId: "unconfigured", actor: "human:owner",
			expectedRevision: before.revision, reason: "Try an edge absent from the pinned version.",
		});
		expect(blocked).toMatchObject({ outcome: "rejected", reasonCode: "TRANSITION_NOT_CONFIGURED", recoveryActions: [expect.stringContaining("aresta configurada")] });

		const allowed = await requestTransitionOperation(root, {
			itemId: "ITEM-1", targetStageId: "compile", actor: "human:owner",
			expectedRevision: before.revision, reason: "Follow the configured non-default edge.", force: true,
		});
		expect(allowed).toMatchObject({ outcome: "accepted", reasonCode: "TRANSITION_COMPLETED", nextDirection: { item: { id: "ITEM-1", stage: "compile" } } });
	});

	it("commits stage, handoff, claim, Run, audit and idempotency as one passage", async () => {
		const root = fixture();
		configureHarness(root);
		configurePassageRuntimeBindings(root);
		const created = createWorkflowDefinition(root, { name: "Passage", actor: "human:owner", content: { name: "Passage", initialStageId: "code", stages: [{ id: "code", allow: ["implementer"], transitions: [{ target: "review" }] }, { id: "review", allow: ["reviewer"], final: true }] } });
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Publish passage flow." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { workflowVersionId: published.id, workflowVersionNumber: published.number, claimedBy: "implementer", claimExecutorId: "codex", claimCapability: "write_code", claimRevision: "sha256:claim", claimExpiresAt: new Date(Date.now() + 60_000).toISOString(), claimTtlMinutes: 30 });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1", "- [x] **AC1"));
		const now = new Date().toISOString();
		const run = { id: "run-passage", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "implementer", identityId: "implementer", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-passage", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: published.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: { owner: "codex", expiresAt: new Date(Date.now() + 60_000).toISOString(), heartbeatAt: null, ttlMinutes: 1 }, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const input = { itemId: "ITEM-1", targetStageId: "review", to: "reviewer", actor: "implementer", executorId: "codex", summary: "Ready for review", evidence: ["tests passed"], expectedRevision: before.revision, reason: "Implementation is complete.", idempotencyKey: "passage-once" };
		const passed = requestPassageOperation(root, input);
		expect(passed).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED", nextDirection: { item: { stage: "review" }, run: { id: run.id, status: "queued" } } });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0]).toMatchObject({ stage: "review", handoff: { to: "reviewer" } });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0]).not.toHaveProperty("claimedBy");
		expect(readExecutionRuns(root).runs[0]).toMatchObject({ revision: 2, workflowStageId: "review", status: "queued", lease: null, binding: { actorId: "reviewer", identityId: "reviewer", roleId: "reviewer", executorId: "opencode" }, handoffs: [{ toActorId: "reviewer" }] });
		const replay = requestPassageOperation(root, input);
		expect(replay).toEqual(passed);
		const concurrentReplays = await Promise.all([input, input].map(async () => requestPassageOperation(root, input)));
		expect(concurrentReplays).toEqual([passed, passed]);
		const conflict = requestPassageOperation(root, { ...input, reason: "Reuse key with different input." });
		expect(conflict).toMatchObject({ outcome: "rejected", reasonCode: "IDEMPOTENCY_KEY_CONFLICT" });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].stage).toBe("review");
		const audits = loadSessionLog(root).entries.filter((entry) => entry.details?.transactionId && entry.details?.reasonCode === "PASSAGE_COMPLETED");
		expect(audits).toHaveLength(1);
	});

	it("routes the legacy handoff surface through the same atomic passage contract", async () => {
		const { root, input } = authorizedPassageFixture();
		const { targetStageId: _targetStageId, ...handoffInput } = input;
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflowBefore = readFileSync(workflowPath, "utf8");
		setWorkspaceTransactionFailureInjectorForTests(() => { throw new Error("INJECTED_PRECOMMIT_FAILURE"); });
		let failed: Awaited<ReturnType<typeof requestHandoffOperation>>;
		try { failed = await requestHandoffOperation(root, handoffInput); }
		finally { setWorkspaceTransactionFailureInjectorForTests(undefined); }
		expect(failed!).toMatchObject({ outcome: "rejected", reasonCode: "PASSAGE_COMMIT_FAILED" });
		expect(readFileSync(workflowPath, "utf8")).toBe(workflowBefore);
		const outcome = await requestHandoffOperation(root, handoffInput);
		expect(outcome).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED", nextDirection: { item: { stage: "review" } } });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0]).toMatchObject({ stage: "review", handoff: { from: "implementer", to: "reviewer" } });
		expect(loadSessionLog(root).entries.filter((entry) => entry.details?.reasonCode === "PASSAGE_COMPLETED")).toHaveLength(1);
	});

	it("resolves an MCP handoff actor from its unique executor-stage runtime binding", async () => {
		const { root, input } = authorizedPassageFixture();
		const { targetStageId: _targetStageId, ...handoffInput } = input;
		const outcome = await requestHandoffOperation(root, { ...handoffInput, actor: "mcp:unknown-client" });
		expect(outcome).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED", nextDirection: { item: { stage: "review" } } });
		expect(JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0].handoff).toMatchObject({ from: "implementer", to: "reviewer" });
	});

	it("checks revision before resolving a legacy handoff destination", async () => {
		const { root, input } = authorizedPassageFixture();
		const { targetStageId: _targetStageId, ...handoffInput } = input;
		const stale = await requestHandoffOperation(root, { ...handoffInput, to: "unknown-role", expectedRevision: "stale-revision" });
		expect(stale).toMatchObject({ outcome: "rejected", reasonCode: "DIRECTION_STALE" });
		const current = resolveAgentDirection(root, "ITEM-1").revision;
		const unresolved = await requestHandoffOperation(root, { ...handoffInput, to: "unknown-role", expectedRevision: current });
		expect(unresolved).toMatchObject({ outcome: "rejected", reasonCode: "PASSAGE_TARGET_UNRESOLVED" });
	});

	it("recovers and replays an accepted passage when interrupted after the commit marker", () => {
		const root = fixture();
		configureHarness(root);
		configurePassageRuntimeBindings(root);
		const created = createWorkflowDefinition(root, { name: "Passage recovery", actor: "human:owner", content: { name: "Passage recovery", initialStageId: "code", stages: [{ id: "code", allow: ["implementer"], transitions: [{ target: "review" }] }, { id: "review", allow: ["reviewer"], final: true }] } });
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Publish recoverable passage." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { workflowVersionId: published.id, claimedBy: "implementer", claimExecutorId: "codex", claimExpiresAt: new Date(Date.now() + 60_000).toISOString() });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1", "- [x] **AC1"));
		const now = new Date().toISOString();
		const run = { id: "run-recovery", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "implementer", identityId: "implementer", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-recovery", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: published.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const input = { itemId: "ITEM-1", targetStageId: "review", to: "reviewer", actor: "implementer", executorId: "codex", summary: "Ready", evidence: ["passed"], expectedRevision: before.revision, reason: "Recover committed passage.", idempotencyKey: "passage-post-marker" };
		setWorkspaceTransactionFailureInjectorForTests((point) => { if (point === "after-commit-marker") throw new Error("INJECTED_AFTER_MARKER"); });
		let outcome: ReturnType<typeof requestPassageOperation>;
		try { outcome = requestPassageOperation(root, input); }
		finally { setWorkspaceTransactionFailureInjectorForTests(undefined); }
		expect(outcome!).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].stage).toBe("review");
		expect(readExecutionRuns(root).runs[0]).toMatchObject({ revision: 2, workflowStageId: "review", status: "queued" });
		expect(requestPassageOperation(root, input)).toEqual(outcome);
		expect(loadSessionLog(root).entries.filter((entry) => entry.details?.reasonCode === "PASSAGE_COMPLETED")).toHaveLength(1);
	});

	it("leaves workflow, Run and audit untouched when a passage fails before commit", () => {
		const root = fixture();
		configureHarness(root);
		configurePassageRuntimeBindings(root);
		const created = createWorkflowDefinition(root, { name: "Passage", actor: "human:owner", content: { name: "Passage", initialStageId: "code", stages: [{ id: "code", allow: ["implementer"], transitions: [{ target: "review" }] }, { id: "review", allow: ["reviewer"], final: true }] } });
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Publish passage flow." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { workflowVersionId: published.id, claimedBy: "implementer", claimExecutorId: "codex", claimExpiresAt: new Date(Date.now() + 60_000).toISOString() });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1", "- [x] **AC1"));
		const now = new Date().toISOString();
		const run = { id: "run-failed-passage", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "implementer", identityId: "implementer", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-passage", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: published.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const workflowBefore = readFileSync(workflowPath, "utf8");
		const runsBefore = readFileSync(join(root, ".letra", "runtime", "runs.json"), "utf8");
		const auditCount = loadSessionLog(root).entries.length;
		setWorkspaceTransactionFailureInjectorForTests(() => { throw new Error("INJECTED_PRECOMMIT_FAILURE"); });
		let outcome: ReturnType<typeof requestPassageOperation>;
		const input = { itemId: "ITEM-1", targetStageId: "review", to: "reviewer", actor: "implementer", executorId: "codex", summary: "Ready", evidence: ["tests passed"], expectedRevision: before.revision, reason: "Fail before commit.", idempotencyKey: "passage-retry" };
		try { outcome = requestPassageOperation(root, input); }
		finally { setWorkspaceTransactionFailureInjectorForTests(undefined); }
		expect(outcome!).toMatchObject({ outcome: "rejected", reasonCode: "PASSAGE_COMMIT_FAILED" });
		expect(readFileSync(workflowPath, "utf8")).toBe(workflowBefore);
		expect(readFileSync(join(root, ".letra", "runtime", "runs.json"), "utf8")).toBe(runsBefore);
		expect(loadSessionLog(root).entries).toHaveLength(auditCount);
		expect(requestPassageOperation(root, input)).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
	});

	it("rejects a stale Run-store CAS before projecting the workflow change", () => {
		const root = fixture();
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflowBefore = readFileSync(workflowPath, "utf8");
		const dataRoot = getLetraDir(root);
		const runsPath = join(dataRoot, "runtime", "runs.json");
		const now = new Date().toISOString();
		createExecutionRun(root, { id: "run-cas", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "implementer", identityId: "implementer", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual", actorId: "human:owner", referenceId: "grant-cas", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: "v1", workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" });
		const staleRuns = readFileSync(runsPath, "utf8");
		updateExecutionRun(root, "run-cas", 1, (run) => ({ ...run, revision: 2, updatedAt: new Date().toISOString() }));
		const workflow = JSON.parse(workflowBefore);
		workflow.items[0].stage = "review";
		const sha = (value: string) => createHash("sha256").update(value).digest("hex");
		expect(() => commitWorkspaceTransaction(root, { transactionId: randomUUID(), writes: [{ path: workflowPath, expectedHash: sha(workflowBefore), contents: JSON.stringify(workflow, null, 2) }, { path: runsPath, expectedHash: sha(staleRuns), contents: staleRuns }], validate: () => undefined })).toThrow("WORKSPACE_TRANSACTION_CAS_CONFLICT");
		expect(readFileSync(workflowPath, "utf8")).toBe(workflowBefore);
	});

	it("migrates only the authorized Run to a validated published workflow version and audits it", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-domain-migration-"));
		roots.push(root);
		mkdirSync(join(root, "identity"), { recursive: true });
		writeFileSync(join(root, "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test", createdAt: new Date().toISOString() }));
		mkdirSync(join(root, "specs", "controlled-operation"), { recursive: true });
		writeFileSync(join(root, "workflow.json"), JSON.stringify({ version: "1.0", name: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stages: [{ id: "code", name: "Code", order: 0 }], items: [{ id: "ITEM-1", description: "Migration", stage: "code", spec: "controlled-operation", createdAt: new Date().toISOString() }], tools: [] }));
		writeFileSync(join(root, "specs", "controlled-operation", "spec.md"), "# Spec\n- [ ] **AC1**: migration test\n");
		const actor = "human:owner";
		const definition = createWorkflowDefinition(root, { name: "Migration", actor, content: { name: "Migration", initialStageId: "code", stages: [{ id: "code", transitions: [{ target: "review" }] }, { id: "review", final: true }] } });
		const v1 = publishWorkflowDraft(root, definition.definition.id, { expectedRevision: 1, actor, reason: "v1" });
		const draft = JSON.parse(JSON.stringify(v1.content));
		// Publish a second immutable version with the same stage contract.
		createWorkflowDraft(root, definition.definition.id, actor, 1);
		updateWorkflowDraft(root, definition.definition.id, { expectedRevision: 1, actor, content: draft });
		const v2 = publishWorkflowDraft(root, definition.definition.id, { expectedRevision: 2, actor, reason: "v2" });
		const now = new Date().toISOString();
		const run = { id: "run-migrate", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "agent:test", identityId: "test", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-1", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: v1.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const details = { runId: run.id, toWorkflowVersionId: v2.id, toStageId: "review", expectedRunRevision: 1, expectedDirectionRevision: before.revision, reason: "Move this run after schema validation." };
		const proof = signLocalOperation(root, actor, "run.workflow.migrate", details);
		const migrated = migrateRunWorkflowOperation(root, { ...details, expectedRevision: before.revision, actor, proof });
		expect(migrated, migrated.reason).toMatchObject({ outcome: "accepted", reasonCode: "RUN_WORKFLOW_MIGRATED" });
		expect(readExecutionRuns(root).runs[0]).toMatchObject({ workflowVersionId: v2.id, workflowStageId: "review", revision: 2, workflowMigrationHistory: [{ fromWorkflowVersionId: v1.id, toWorkflowVersionId: v2.id, fromStageId: "code", toStageId: "review", actorId: actor }] });
		expect(loadSessionLog(root).entries.some((entry) => entry.details?.reasonCode === "RUN_WORKFLOW_MIGRATED" && entry.details?.runId === run.id)).toBe(true);
	});

	it("rejects a stale Run revision and a draft target before writing", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-domain-migration-"));
		roots.push(root);
		mkdirSync(join(root, "identity"), { recursive: true });
		writeFileSync(join(root, "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test", createdAt: new Date().toISOString() }));
		mkdirSync(join(root, "specs", "controlled-operation"), { recursive: true });
		writeFileSync(join(root, "workflow.json"), JSON.stringify({ version: "1.0", name: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stages: [{ id: "code", name: "Code", order: 0 }], items: [{ id: "ITEM-1", description: "Migration", stage: "code", spec: "controlled-operation", createdAt: new Date().toISOString() }], tools: [] }));
		writeFileSync(join(root, "specs", "controlled-operation", "spec.md"), "# Spec\n- [ ] **AC1**: migration test\n");
		const actor = "human:owner";
		const definition = createWorkflowDefinition(root, { name: "Migration", actor, content: { name: "Migration", initialStageId: "code", stages: [{ id: "code", final: true }] } });
		const v1 = publishWorkflowDraft(root, definition.definition.id, { expectedRevision: 1, actor, reason: "v1" });
		createWorkflowDraft(root, definition.definition.id, actor, 1);
		const now = new Date().toISOString();
		const run = { id: "run-stale", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "agent:test", identityId: "test", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: actor, referenceId: "grant-1", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: v1.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const details = { runId: run.id, toWorkflowVersionId: definition.draft.id, toStageId: "code", expectedRunRevision: 2, expectedDirectionRevision: before.revision, reason: "Reject draft target." };
		const proof = signLocalOperation(root, actor, "run.workflow.migrate", details);
		const rejected = migrateRunWorkflowOperation(root, { ...details, expectedRevision: before.revision, actor, proof });
		expect(rejected).toMatchObject({ outcome: "rejected", reasonCode: "RUN_REVISION_CONFLICT" });
		expect(readExecutionRuns(root).runs[0]).toEqual(run);
	});

	it("rejects an unsigned Run migration without changing the canonical Run store", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-domain-migration-"));
		roots.push(root);
		writeFileSync(join(root, "workflow.json"), JSON.stringify({ version: "1.0", name: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stages: [{ id: "code", name: "Code", order: 0 }], items: [{ id: "ITEM-1", description: "Migration", stage: "code", spec: "controlled-operation", createdAt: new Date().toISOString() }], tools: [] }));
		mkdirSync(join(root, "specs", "controlled-operation"), { recursive: true });
		writeFileSync(join(root, "specs", "controlled-operation", "spec.md"), "# Spec\n- [ ] **AC1**: migration test\n");
		const now = new Date().toISOString();
		const run = { id: "run-unsigned", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "agent:test", identityId: "test", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-1", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: "missing-v1", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, "ITEM-1");
		const output = migrateRunWorkflowOperation(root, { runId: run.id, toWorkflowVersionId: "missing-v2", toStageId: "review", expectedRunRevision: 1, expectedRevision: before.revision, reason: "unauthorized", actor: "human:owner" });
		expect(output).toMatchObject({ outcome: "rejected", reasonCode: "SIGNED_OPERATION_REQUIRED" });
		expect(readExecutionRuns(root).runs[0]).toEqual(run);
	});

	it("authorizes security_review by arbitrary configured stage rather than role name", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.stages[0] = { id: "nebula", name: "Nebula", order: 0, zone: "doing" };
		workflow.items[0].stage = "nebula";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const flowPath = join(root, ".letra", "harness", "v0.2.0", "flows", "controlled-flow.yaml");
		writeFileSync(flowPath, readFileSync(flowPath, "utf8").replace("defaultPolicy: default", "defaultPolicy: default\noperations:\n  security_review:\n    requires_claim: true\n    allowed_in_stages:\n      - nebula").replace("id: code", "id: nebula"));
		const before = resolveAgentDirection(root, "ITEM-1");
		const allowedStage = await runSecurityReviewOperation(root, { itemId: "ITEM-1", executorId: "scanner", actor: "sentinel", expectedRevision: before.revision, reason: "Configured scan." });
		expect(allowedStage.reasonCode).toBe("CLAIM_REQUIRED");
		writeFileSync(flowPath, readFileSync(flowPath, "utf8").replace("      - nebula", "      - other").replace("agents: [\"implementer\"]", "agents: [\"security\"]"));
		const deniedRevision = resolveAgentDirection(root, "ITEM-1").revision;
		const denied = await runSecurityReviewOperation(root, { itemId: "ITEM-1", executorId: "scanner", actor: "security", expectedRevision: deniedRevision, reason: "Role name must not authorize." });
		expect(denied).toMatchObject({ outcome: "rejected", reasonCode: "SECURITY_STAGE_REQUIRED" });
	});

	it("permits rework without creating ACs when create_ac is false", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.items[0].stage = "review";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const flowPath = join(root, ".letra", "harness", "v0.2.0", "flows", "controlled-flow.yaml");
		writeFileSync(flowPath, readFileSync(flowPath, "utf8").replace("create_ac: true", "create_ac: false"));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		const original = readFileSync(specPath, "utf8");
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await requestReworkOperation(root, { itemId: "ITEM-1", actor: "reviewer", expectedRevision: before.revision, reason: "Configured correction.", acceptanceCriteria: [] });
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "REWORK_REQUESTED", nextDirection: { item: { stage: "code" } } });
		expect(readFileSync(specPath, "utf8")).toBe(original);
	});

	it("enforces auto and requires_claim semantics for on_enter hooks", async () => {
		for (const hookConfig of ["auto: false", "auto: true\n          requires_claim: true"]) {
			const root = fixture();
			configureHarness(root);
			const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
			writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1", "- [x] **AC1"));
			const flowPath = join(root, ".letra", "harness", "v0.2.0", "flows", "controlled-flow.yaml");
			writeFileSync(flowPath, readFileSync(flowPath, "utf8").replace("    rework:\n      target: code", `    hooks:\n      on_enter:\n        - action: capture_baseline\n          ${hookConfig}\n    rework:\n      target: code`));
			const before = resolveAgentDirection(root, "ITEM-1");
			const result = await requestTransitionOperation(root, { itemId: "ITEM-1", targetStageId: "review", actor: "human:owner", expectedRevision: before.revision, reason: "Exercise hook policy.", force: true });
			expect(result.outcome).toBe("accepted");
			const stored = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8"));
			expect(stored.items[0].securityBaseline).toBeUndefined();
		}
	});
	it("activates a backlog item through the canonical human operation and creates the first handoff", async () => {
		const root = fixture();
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.stages = [{ id: "backlog", name: "Backlog", order: 0, zone: "todo" }, { id: "design", name: "Design", order: 1, zone: "doing" }];
		workflow.items[0].stage = "backlog";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const harness = join(root, ".letra", "harness", "v0.2.0");
		mkdirSync(join(harness, "flows"), { recursive: true });
		mkdirSync(join(harness, "roles"), { recursive: true });
		mkdirSync(join(harness, "gates"), { recursive: true });
		writeFileSync(join(harness, "flows", "controlled-flow.yaml"), "id: controlled-flow\nversion: 1\nname: Controlled\ndescription: test\ndefaultPolicy: default\nstages:\n  - id: backlog\n    name: Backlog\n    order: 0\n    description: queued\n    agents: []\n    gate: null\n  - id: design\n    name: Design\n    order: 1\n    description: define\n    agents:\n      - analyst\n    gate: null\n");
		writeFileSync(join(harness, "roles", "analyst.yaml"), "id: analyst\nlabel: Analyst\ndescription: test\nallowedStages:\n  - design\ncapabilities:\n  - write_spec\n");
		workflow.template = "controlled-flow"; workflow.harnessVersion = "v0.2.0";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await activateWorkOperation(root, { itemId: "ITEM-1", actor: "human:owner", expectedRevision: before.revision, reason: "Prioridade confirmada." });
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "WORK_ACTIVATED" });
		const stored = JSON.parse(readFileSync(workflowPath, "utf-8"));
		expect(stored.items[0]).toMatchObject({ stage: "design", handoff: { from: "human:owner", to: "analyst" } });
	});

	it("rejects stale revisions and missing regression evidence without changing the spec", () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		const original = readFileSync(specPath, "utf-8");

		const stale = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: "sha256:stale",
			evidence: ["61 focused tests passed"],
			reason: "Implementation completed.",
			actor: "agent:test",
		});
		const withoutEvidence = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: [],
			reason: "Implementation completed.",
			actor: "agent:test",
		});

		expect(stale).toMatchObject({
			outcome: "rejected",
			reasonCode: "DIRECTION_STALE",
			beforeRevision: before.revision,
			afterRevision: before.revision,
		});
		expect(withoutEvidence).toMatchObject({
			outcome: "rejected",
			reasonCode: "REGRESSION_EVIDENCE_REQUIRED",
		});
		expect(stale.auditId).toMatch(/^log-/);
		expect(withoutEvidence.auditId).toMatch(/^log-/);
		expect(readFileSync(specPath, "utf-8")).toBe(original);
	});

	it("rejects AC mutation without an explicit item target and leaves the spec unchanged", () => {
		const root = fixture();
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		const original = readFileSync(specPath, "utf-8");
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: ["Regression test passed"],
			reason: "Must reject implicit target.",
			actor: "agent:test",
		} as never);

		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "ITEM_TARGET_REQUIRED" });
		expect(readFileSync(specPath, "utf-8")).toBe(original);
	});

	it("completes only the current AC and returns the new canonical revision", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim para teste." });
		expect(claim.outcome).toBe("accepted");

		const result = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: claim.afterRevision,
			evidence: ["Targeted tests: 12 passed", "Typecheck passed"],
			reason: "Acceptance criterion verified.",
			actor: "agent:test",
		});

		expect(result).toMatchObject({
			outcome: "accepted",
			beforeRevision: claim.afterRevision,
			reasonCode: "AC_COMPLETED",
		});
		expect(result.afterRevision).not.toBe(before.revision);
		expect(result.nextDirection.pendingAC).toBeNull();
		expect(loadSessionLog(root).entries.at(-1)).toMatchObject({
			id: result.auditId,
			action: "agent_ac_completion_requested",
			acId: "AC1",
			details: expect.objectContaining({
				outcome: "accepted",
				evidence: ["Targeted tests: 12 passed", "Typecheck passed"],
			}),
		});
	});

	it("completes a gap criterion stored only in acceptance.md", async () => {
		const root = fixture();
		const specDir = join(root, ".letra", "specs", "controlled-operation");
		const specPath = join(specDir, "spec.md");
		const acceptancePath = join(specDir, "acceptance.md");
		writeFileSync(specPath, "# Spec\n- [x] **AC1**: original work\n");
		writeFileSync(acceptancePath, "# Acceptance\n- [ ] **AC-gap-2.1**: local identity registry\n");
		const before = resolveAgentDirection(root, "ITEM-1");
		expect(before.pendingAC?.id).toBe("AC-gap-2.1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim for gap." });
		expect(claim.outcome).toBe("accepted");
		const result = completeAcOperation(root, { itemId: "ITEM-1", acId: "AC-gap-2.1", expectedRevision: claim.afterRevision, evidence: ["Identity registry test passed"], reason: "Gap verified.", actor: "agent:test", executorId: "test" });
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "AC_COMPLETED", nextDirection: { pendingAC: null } });
		expect(readFileSync(specPath, "utf8")).toContain("[x] **AC1**");
		expect(readFileSync(acceptancePath, "utf8")).toContain("[x] **AC-gap-2.1**");
	});

	it("makes claim and execution audit queryable by Run with revision and cycle", async () => {
		const root = fixture();
		configureHarness(root);
		const created = createWorkflowDefinition(root, {
			name: "Audit Run workflow",
			actor: "human:owner",
			content: { name: "Audit Run workflow", initialStageId: "code", stages: [{ id: "code", transitions: [{ target: "review" }] }, { id: "review", final: true }] },
		});
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Pin workflow for audit test." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.items[0].workflowVersionId = published.id;
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Audit Run claim." });
		const run = readExecutionRuns(root).runs[0]!;
		expect(run).toBeDefined();
		const claimAudit = loadSessionLog(root).entries.find((entry) => entry.id === claim.auditId)!;
		expect(claimAudit.details).toMatchObject({ runId: run.id, runRevision: run.revision, cycle: run.cycle.number });
		const { queryLogWithMeta } = await import("../session-log.js");
		expect(queryLogWithMeta(root, { runId: run.id, all: true }).entries.map((entry) => entry.id)).toContain(claim.auditId);
	});

	it("rejects transition with pending ACs and requires passage after completion", async () => {
		const root = fixture();
		const initial = resolveAgentDirection(root, "ITEM-1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: initial.revision, reason: "Claim para teste." });
		expect(claim).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" });
		const rejected = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: claim.afterRevision,
			reason: "Request review.",
			actor: "agent:test",
		});
		expect(rejected).toMatchObject({
			outcome: "rejected",
			reasonCode: "PENDING_ACCEPTANCE_CRITERIA",
			recoveryActions: [expect.stringContaining("AC pendente")],
		});

		const completed = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: claim.afterRevision,
			evidence: ["Regression suite passed"],
			reason: "Criterion verified.",
			actor: "agent:test",
			executorId: "test",
		});
		const accepted = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: completed.afterRevision,
			reason: "Request review.",
			actor: "agent:test",
		});

		expect(accepted).toMatchObject({ outcome: "rejected", beforeRevision: completed.afterRevision, reasonCode: "CANONICAL_PASSAGE_REQUIRED" });
		expect(accepted.nextDirection.item).toMatchObject({ id: "ITEM-1", stage: "code" });
		expect(accepted.afterRevision).toBe(completed.afterRevision);
	});

	it("requires canonical passage for agent stage changes and leaves workflow untouched", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const claimed = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim for canonical passage regression." });
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflowBefore = readFileSync(workflowPath, "utf8");
		const transition = await requestTransitionOperation(root, { itemId: "ITEM-1", targetStageId: "review", actor: "agent:test", expectedRevision: claimed.afterRevision, reason: "Attempt split transition." });
		expect(transition).toMatchObject({ outcome: "rejected", reasonCode: "PENDING_ACCEPTANCE_CRITERIA" });
		expect(readFileSync(workflowPath, "utf8")).toBe(workflowBefore);
	});

	it("allows an audited human administrative transition without completing pending ACs", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const accepted = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: before.revision,
			reason: "Supervisor approved implementation despite completion ACs.",
			actor: "human:owner",
			force: true,
		});

		expect(accepted).toMatchObject({ outcome: "accepted", reasonCode: "TRANSITION_COMPLETED" });
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "spec.md"), "utf8")).toContain("- [ ] **AC1**");
		const auditEntry = loadSessionLog(root).entries.find((entry) => entry.id === accepted.auditId);
		expect(auditEntry?.details).toMatchObject({ administrativeOverride: true, pendingAcBypassed: "AC1" });
	});

	it("uses spec approval to enter Code while implementation ACs remain pending", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.stages = [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "design", name: "Design", order: 1, zone: "doing" },
			{ id: "code", name: "Code", order: 2, zone: "doing" },
			{ id: "review", name: "Review", order: 3, zone: "doing" },
		];
		workflow.items[0].stage = "design";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

		const flowPath = join(root, ".letra", "harness", "v0.2.0", "flows", "controlled-flow.yaml");
		writeFileSync(flowPath, [
			"id: controlled-flow",
			"version: 1.0.0",
			"name: Controlled Flow",
			"description: spec approval test",
			"defaultPolicy: default",
			"stages:",
			"  - id: backlog",
			"    name: Backlog",
			"    order: 0",
			"    zone: todo",
			"    agents: []",
			"  - id: design",
			"    name: Design",
			"    order: 1",
			"    zone: doing",
			"    agents: [\"analyst\"]",
			"    gate: null",
			"    phases:",
			"      initialState: define",
			"      states:",
			"        define:",
			"          id: define",
			"          label: Define",
			"          description: Spec is ready for human approval",
			"          transitions:",
			"            - target: handoff",
			"              gate: spec-approved",
			"        handoff:",
			"          id: handoff",
			"          label: Handoff",
			"          description: Approved for implementation",
			"  - id: code",
			"    name: Code",
			"    order: 2",
			"    zone: doing",
			"    agents: [\"implementer\"]",
			"  - id: review",
			"    name: Review",
			"    order: 3",
			"    zone: doing",
			"    agents: [\"reviewer\"]",
		].join("\n"));
		writeFileSync(join(root, ".letra", "harness", "v0.2.0", "gates", "spec-approved.yaml"), [
			"id: spec-approved",
			"name: Spec Approved",
			"type: human",
			"blocking: true",
			"blocksHandoff: true",
			"decisions:",
			"  approve: code",
			"  request-changes: design",
			"  reject: backlog",
		].join("\n"));

		const actor = "human:owner";
		const expectedRevision = resolveAgentDirection(root, "ITEM-1").revision;
		const reason = "Spec approved; implementation ACs remain open.";
		const approvalRequest = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "code",
			expectedRevision,
			reason: "Request spec approval before implementation.",
			actor,
		});
		expect(approvalRequest).toMatchObject({
			outcome: "approval-required",
			reasonCode: "HUMAN_APPROVAL_REQUIRED",
			nextDirection: { pendingAC: undefined },
		});
		const cwd = process.cwd();
		const output: string[] = [];
		const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		try {
			process.chdir(root);
			await operationCommand().parseAsync([
				"gate-decision", "ITEM-1", "--decision", "approve",
				"--expected-revision", expectedRevision, "--reason", reason,
			], { from: "user" });
		} finally {
			process.chdir(cwd);
			stdout.mockRestore();
		}
		const decision = JSON.parse(output.join(""));

		expect(decision).toMatchObject({ outcome: "accepted", reasonCode: "GATE_DECISION_RECORDED", nextDirection: { item: { stage: "code" }, pendingAC: { id: "AC1" } } });
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "spec.md"), "utf8")).toContain("- [ ] **AC1**");
	});

	it("rejects a forced transition without a human actor", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const rejected = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: before.revision,
			reason: "Attempt bypass.",
			actor: "implementer",
			force: true,
		});

		expect(rejected).toMatchObject({ outcome: "rejected", reasonCode: "ADMINISTRATIVE_OVERRIDE_REQUIRED" });
	});

	it("requires actor identity for AC completion and transitions", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const complete = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: ["Regression suite passed"],
			reason: "Criterion verified.",
			actor: "",
		});
		expect(complete).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_REQUIRED" });
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "spec.md"), "utf8")).toContain("- [ ] **AC1");

		const transition = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: before.revision,
			reason: "Request review.",
			actor: "",
		});
		expect(transition).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_REQUIRED" });
	});

	it("enforces a blocking stage gate before handoff", async () => {
		const root = fixture();
		configureHarness(root, "review-gate");
		configurePassageRuntimeBindings(root);
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf-8").replace("- [ ] **AC1**", "- [x] **AC1**"));
		writeFileSync(
			join(root, ".letra", "harness", "v0.2.0", "gates", "review-gate.yaml"),
			"id: review-gate\nname: Review Gate\ntype: automated\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
		);
		const before = resolveAgentDirection(root, "ITEM-1");
		const claimed = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		claimed.items[0].claimedBy = "implementer";
		claimed.items[0].claimExecutorId = "executor:test";
		claimed.items[0].claimCapability = "write_code";
		claimed.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(claimed, null, 2));
		const current = resolveAgentDirection(root, "ITEM-1");
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1",
			to: "reviewer",
			executorId: "executor:test",
			summary: "Ready for review",
			evidence: ["tests passed"],
			expectedRevision: current.revision,
			reason: "Request gated handoff.",
			actor: "implementer",
		});
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "BLOCKING_GATE" });
		const after = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		expect(after.items[0]).toMatchObject({ claimedBy: "implementer" });
		expect(after.items[0].handoff).toBeUndefined();
	});

	it("replaces the inbound handoff when its actor completes the claimed stage", async () => {
		const root = fixture();
		configureHarness(root);
		configurePassageRuntimeBindings(root);
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf-8").replace("- [ ] **AC1**", "- [x] **AC1**"));
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.items[0].claimedBy = "implementer";
		workflow.items[0].claimExecutorId = "executor:test";
		workflow.items[0].claimCapability = "write_code";
		workflow.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		workflow.items[0].handoff = { from: "design", to: "agent:test", summary: "Incoming", evidence: [], timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), executorId: "executor:test" };
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1", to: "reviewer", executorId: "executor:test", summary: "Outgoing", evidence: ["tests passed"],
			expectedRevision: before.revision, reason: "Advance to review.", actor: "implementer",
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
		const after = JSON.parse(readFileSync(workflowPath, "utf-8"));
		expect(after.items[0].handoff).toMatchObject({ from: "implementer", to: "reviewer" });
		expect(after.items[0]).not.toHaveProperty("claimedBy");
		expect(after.items[0]).not.toHaveProperty("claimExecutorId");
		expect(after.items[0]).not.toHaveProperty("claimExpiresAt");
	});

	it("replaces an expired handoff so a completed claim can reach the next actor", async () => {
		const root = fixture();
		configureHarness(root);
		configurePassageRuntimeBindings(root);
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf-8").replace("- [ ] **AC1**", "- [x] **AC1**"));
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		Object.assign(workflow.items[0], {
			claimedBy: "implementer",
			claimExecutorId: "executor:test",
			claimCapability: "write_code",
			claimExpiresAt: new Date(Date.now() + 60_000).toISOString(),
			handoff: { from: "old-executor", to: "reviewer", summary: "expired", evidence: [], timestamp: "2026-09-10T10:00:00.000Z", expiresAt: "2026-09-10T10:01:00.000Z" },
		});
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1", to: "reviewer", executorId: "executor:test", actor: "implementer",
			summary: "Fresh handoff", evidence: ["tests passed"], expectedRevision: before.revision, reason: "Substituir handoff expirado.",
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" });
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8")).items[0];
		expect(persisted.handoff).toMatchObject({ from: "implementer", to: "reviewer", summary: "Fresh handoff" });
		expect(persisted.handoffHistory).toEqual([expect.objectContaining({ summary: "expired", status: "expired" })]);
	});

	it("rejects a claim from an actor that is not assigned to the current stage", async () => {
		const root = fixture();
		configureHarness(root);
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await (await import("./service.js")).claimOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "executor:test", capability: "read_code",
			expectedRevision: before.revision, reason: "Invalid actor claim.",
		});
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });
	});

	it("allows only the current handoff recipient to claim before the stage transition", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.items[0].handoff = {
			status: "pending",
			from: "implementer",
			to: "reviewer",
			summary: "Implementation ready for review.",
			evidence: ["tests passed"],
			timestamp: new Date().toISOString(),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			executorId: "codex",
		};
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

		const before = resolveAgentDirection(root, "ITEM-1");
		const accepted = await claimOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "codex", capability: "review_code",
			expectedRevision: before.revision, reason: "Accept the directed review handoff.",
		});
		expect(accepted).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED", nextDirection: { item: { claimedBy: "reviewer", claimExecutorId: "codex" } } });

		const stored = JSON.parse(readFileSync(workflowPath, "utf8"));
		expect(stored.items[0].handoff.status).toBe("accepted");
		const completed = await recordExecutionEvent(root, { itemId: "ITEM-1", executorId: "codex", actor: "reviewer", status: "succeeded", expectedRevision: accepted.afterRevision, reason: "Complete the accepted handoff." });
		expect(completed).toMatchObject({ outcome: "accepted", reasonCode: "EVENT_RECORDED" });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].handoff.status).toBe("completed");
		stored.items[0].claimedBy = undefined;
		stored.items[0].claimExecutorId = undefined;
		stored.items[0].claimExpiresAt = undefined;
		writeFileSync(workflowPath, JSON.stringify(stored, null, 2));
		const mismatchRevision = resolveAgentDirection(root, "ITEM-1").revision;
		const mismatchedExecutor = await claimOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "other", capability: "review_code",
			expectedRevision: mismatchRevision, reason: "A different executor must not consume the handoff.",
		});
		expect(mismatchedExecutor).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });
	});

	it("does not allow the recipient to claim an expired handoff", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		workflow.items[0].handoff = { from: "implementer", to: "implementer", summary: "Expired", evidence: [], timestamp: "2026-09-10T10:00:00.000Z", expiresAt: "2026-09-10T10:01:00.000Z", status: "pending" };
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const rejectedClaim = await claimOperation(root, { itemId: "ITEM-1", actor: "implementer", executorId: "codex", capability: "write_code", expectedRevision: before.revision, reason: "Expired handoffs cannot be claimed." });
		expect(rejectedClaim).toMatchObject({ outcome: "rejected", reasonCode: "HANDOFF_EXPIRED", beforeRevision: before.revision, afterRevision: before.revision });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].handoff.status).toBe("pending");
	});

	it("records a cancelled handoff in history when the source rolls it back", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { claimedBy: "agent:test", claimExecutorId: "executor:test", claimExpiresAt: new Date(Date.now() + 60_000).toISOString(), handoff: { from: "agent:test", to: "reviewer", summary: "Cancel me", evidence: ["test"], timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), status: "pending" } });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const cancelled = await rollbackHandoffOperation(root, { itemId: "ITEM-1", actor: "agent:test", expectedRevision: before.revision, reason: "Source cancelled the pending handoff." });
		expect(cancelled).toMatchObject({ outcome: "accepted", reasonCode: "HANDOFF_ROLLED_BACK" });
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8")).items[0];
		expect(persisted.handoff).toBeUndefined();
		expect(persisted.handoffHistory).toEqual([expect.objectContaining({ to: "reviewer", summary: "Cancel me", status: "cancelled" })]);
	});

	it("executes an automatic on_enter hook that requires the newly acquired claim", async () => {
		const root = fixture();
		configureHarness(root);
		const flowPath = join(root, ".letra", "harness", "v0.2.0", "flows", "controlled-flow.yaml");
		writeFileSync(
			flowPath,
			readFileSync(flowPath, "utf8").replace(
				"    agents: [\"implementer\"]",
				"    agents: [\"implementer\"]\n    hooks:\n      on_enter:\n        - action: capture_baseline\n          auto: true\n          requires_claim: true",
			),
		);

		const before = resolveAgentDirection(root, "ITEM-1");
		const claimed = await claimOperation(root, {
			itemId: "ITEM-1", actor: "implementer", executorId: "codex", capability: "write_code",
			expectedRevision: before.revision, reason: "Acquire claim and execute the configured entry hook.",
		});

		expect(claimed).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" });
		const stored = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8"));
		expect(stored.items[0].securityBaseline).toMatchObject({ version: "1", capturedAt: expect.any(String), fingerprint: expect.any(String) });
	});

	it("requires a canonical passage when entering a stage with an exit gate", async () => {
		const root = fixture();
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.template = "security-flow";
		workflow.harnessVersion = "v0.2.0";
		workflow.stages.push({ id: "security", name: "Security", order: 1, zone: "doing" });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const harness = join(root, ".letra", "harness", "v0.2.0");
		mkdirSync(join(harness, "flows"), { recursive: true });
		mkdirSync(join(harness, "gates"), { recursive: true });
		writeFileSync(join(harness, "flows", "security-flow.yaml"), [
			"id: security-flow", "version: 1.0.0", "name: Security Flow", "description: test", "defaultPolicy: default", "stages:",
			"  - id: code", "    name: Code", "    order: 0", "    zone: doing", "    agents: [agent:test]", "    gate: null",
			"  - id: security", "    name: Security", "    order: 1", "    zone: doing", "    agents: [security]", "    gate: human-approved",
		].join("\n"));
		writeFileSync(join(harness, "gates", "human-approved.yaml"), "id: human-approved\nname: Human Approved\ntype: human\nblocking: true\nblocksHandoff: true\ndecisions:\n  approve: done\n");
		const claimed = JSON.parse(readFileSync(workflowPath, "utf-8"));
		claimed.items[0].claimedBy = "agent:test";
		claimed.items[0].claimExecutorId = "executor:test";
		claimed.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		writeFileSync(workflowPath, JSON.stringify(claimed, null, 2));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf-8").replace("- [ ] **AC1", "- [x] **AC1"));
		const before = resolveAgentDirection(root, "ITEM-1");
		const transition = await requestTransitionOperation(root, { itemId: "ITEM-1", targetStageId: "security", actor: "agent:test", expectedRevision: before.revision, reason: "Enter security." });
		expect(transition).toMatchObject({ outcome: "rejected", reasonCode: "CANONICAL_PASSAGE_REQUIRED" });
		expect(transition.nextDirection.item).toMatchObject({ stage: "code" });
	});

it("allows a backward correction via rework operation without the destination exit gate", async () => {
		const root = fixture();
		configureHarness(root, "code-reviewed");
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.items[0].stage = "review";
		workflow.items[0].claimedBy = "reviewer";
		workflow.items[0].claimExecutorId = "codex";
		workflow.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf-8").replace("- [ ] **AC1", "- [x] **AC1"));
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await requestReworkOperation(root, {
			itemId: "ITEM-1",
			actor: "reviewer",
			expectedRevision: before.revision,
			reason: "Return for review corrections.",
			acceptanceCriteria: [{ description: "Correção de erro detectado na revisão." }],
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "REWORK_REQUESTED", nextDirection: { item: { stage: "code" } } });
		expect(result.nextDirection.item).toMatchObject({ stage: "code" });
	});

	it("returns Review to Code through the canonical rework operation with new pending ACs", async () => {
		const root = fixture();
		configureHarness(root);
		writeFileSync(
			join(root, ".letra", "specs", "controlled-operation", "acceptance.md"),
			"# Acceptance Criteria\n\n- [x] **AC1**: operation is controlled\n",
		);
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		writeFileSync(specPath, readFileSync(specPath, "utf8").replace("- [ ] **AC1**", "- [x] **AC1"));
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.items[0].stage = "review";
		workflow.items[0].claimedBy = "reviewer";
		workflow.items[0].claimExecutorId = "codex";
		workflow.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await requestReworkOperation(root, {
			itemId: "ITEM-1",
			actor: "reviewer",
			expectedRevision: before.revision,
			reason: "Cobrir erro de execução antes de liberar a revisão.",
			acceptanceCriteria: [{ description: "O dispatcher deve liberar claim após falha de processo." }],
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "REWORK_REQUESTED", nextDirection: { item: { stage: "code" }, pendingAC: { id: "AC2" } } });
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8"));
		expect(persisted.items[0].handoff).toMatchObject({ from: "reviewer", to: "implementer" });
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "spec.md"), "utf8")).toContain("**AC2 — Correção de revisão**: O dispatcher deve liberar claim");
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "acceptance.md"), "utf8")).toContain("**AC2 — Correção de revisão**: O dispatcher deve liberar claim");
		expect(loadSessionLog(root).entries.some((entry) => entry.action === "agent_transition_requested" && entry.details?.reasonCode === "REWORK_REQUESTED")).toBe(true);
	});

	it("requires the rework operation for Review → Code, then permits the new pending AC and clears reviewer runtime state", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		Object.assign(workflow.items[0], {
			stage: "review",
			claimedBy: "reviewer",
			claimExecutorId: "codex",
			claimExpiresAt: new Date(Date.now() + 60_000).toISOString(),
			activityStatus: "started",
			activityStartedAt: "2026-09-10T10:00:00.000Z",
			lastHeartbeatAt: "2026-09-10T10:01:00.000Z",
			lastFailure: { code: "OLD_FAILURE", message: "stale", recovery: "retry", at: "2026-09-10T10:02:00.000Z" },
			retryCount: 2,
		});
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const direct = await requestTransitionOperation(root, {
			itemId: "ITEM-1", targetStageId: "code", actor: "reviewer", expectedRevision: before.revision, reason: "Return to code.",
		});
		expect(direct).toMatchObject({ outcome: "rejected", reasonCode: "REWORK_OPERATION_REQUIRED" });
		const rework = await requestReworkOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", expectedRevision: before.revision,
			reason: "Registrar correção encontrada no review.",
			acceptanceCriteria: [{ description: "O retorno de revisão preserva somente o handoff do implementer." }],
		});
		expect(rework).toMatchObject({ outcome: "accepted", reasonCode: "REWORK_REQUESTED", nextDirection: { item: { stage: "code" } } });
		expect(readFileSync(join(root, ".letra", "specs", "controlled-operation", "spec.md"), "utf8")).toContain("**AC2 — Correção de revisão**: O retorno de revisão preserva somente o handoff do implementer.");
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8")).items[0];
		expect(persisted).toMatchObject({ stage: "code", handoff: { from: "reviewer", to: "implementer" } });
		expect(persisted).not.toHaveProperty("activityStatus");
		expect(persisted).not.toHaveProperty("activityStartedAt");
		expect(persisted).not.toHaveProperty("lastHeartbeatAt");
		expect(persisted).not.toHaveProperty("lastFailure");
		expect(persisted).not.toHaveProperty("retryCount");
	});

	it("requires a signed gate decision bound to the current revision and reason", async () => {
		const root = fixture();
		const actor = "human:owner";
		const expectedRevision = resolveAgentDirection(root, "ITEM-1").revision;
		const base = { itemId: "ITEM-1", decision: "approve" as const, actor, expectedRevision, reason: "Approved" };
		expect(await decideGateOperation(root, base)).toMatchObject({ outcome: "rejected", reasonCode: "SIGNED_OPERATION_REQUIRED" });
		const proof = signLocalOperation(root, actor, "gate.decision", { itemId: base.itemId, decision: base.decision, expectedRevision, reason: base.reason });
		expect(await decideGateOperation(root, { ...base, reason: "Forged", proof })).toMatchObject({ outcome: "rejected", reasonCode: "SIGNED_OPERATION_REQUIRED" });
		expect(await decideGateOperation(root, { ...base, proof })).toMatchObject({ outcome: "rejected", reasonCode: "GATE_NOT_WAITING" });
	});

	it("returns approval-required without crossing a blocking human gate", async () => {
		const root = fixture();
		const initial = resolveAgentDirection(root, "ITEM-1");
		completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: initial.revision,
			evidence: ["Regression suite passed"],
			reason: "Criterion verified.",
			actor: "agent:test",
		});
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.template = "controlled-flow";
		workflow.harnessVersion = "v0.1.0";
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

		const harness = join(root, ".letra", "harness", "v0.1.0");
		mkdirSync(join(harness, "flows"), { recursive: true });
		mkdirSync(join(harness, "gates"), { recursive: true });
		mkdirSync(join(harness, "roles"), { recursive: true });
		writeFileSync(
			join(harness, "flows", "controlled-flow.yaml"),
			[
				"id: controlled-flow",
				"version: 1.0.0",
				"name: Controlled Flow",
				"description: test",
				"defaultPolicy: default",
				"stages:",
				"  - id: code",
				"    name: Code",
				"    order: 0",
				"    zone: doing",
				"    gate: gates/human-review.yaml",
				"  - id: review",
				"    name: Review",
				"    order: 1",
				"    zone: doing",
			].join("\n"),
		);
		writeFileSync(
			join(harness, "gates", "human-review.yaml"),
			[
				"id: human-review",
				"name: Human Review",
				"type: human",
				"blocking: true",
				"description: explicit human approval",
			].join("\n"),
		);

		const beforeRequest = resolveAgentDirection(root, "ITEM-1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: beforeRequest.revision, reason: "Claim para teste." });
		const completed = completeAcOperation(root, { itemId: "ITEM-1", acId: "AC1", expectedRevision: claim.afterRevision, evidence: ["Gate regression criterion complete"], reason: "Criterion verified.", actor: "agent:test", executorId: "test" });
		const result = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: completed.afterRevision,
			reason: "Request review.",
			actor: "agent:test",
		});

		expect(result).toMatchObject({
			outcome: "approval-required",
			reasonCode: "HUMAN_APPROVAL_REQUIRED",
			beforeRevision: completed.afterRevision,
			afterRevision: completed.afterRevision,
		});
		expect(resolveAgentDirection(root, "ITEM-1").item).toMatchObject({ stage: "code" });
	});

	it("resumes the waiting Run after an authenticated human gate decision", async () => {
		const root = fixture();
		configureHarness(root);
		const created = createWorkflowDefinition(root, {
			name: "Human gate resume",
			actor: "human:owner",
			content: {
				name: "Human gate resume",
				initialStageId: "code",
				stages: [
					{ id: "code", allow: ["implementer"], transitions: [{ target: "review" }] },
					{ id: "review", allow: ["reviewer"], preferredExecutor: "opencode", transitions: [{ target: "done" }] },
					{ id: "done", allow: ["reviewer"], final: true },
				],
			},
		});
		const draft = createWorkflowDraft(root, created.definition.id, "human:owner");
		const content = structuredClone(draft.content);
		content.stages.find((stage) => stage.id === "code")!.gate = "human-review";
		const gateDir = join(root, ".letra", "harness", "v0.2.0", "gates");
		mkdirSync(gateDir, { recursive: true });
		writeFileSync(join(gateDir, "human-review.yaml"), "id: human-review\nname: Human Review\ntype: human\nblocking: true\ndescription: Explicit human approval\ndecisions:\n  approve: review\n");
	const rolesDir = join(root, ".letra", "harness", "v0.2.0", "roles");
	mkdirSync(rolesDir, { recursive: true });
	writeFileSync(join(rolesDir, "implementer.yaml"), "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - read_code\n  - write_code\n  - run_tests\n");
	writeFileSync(join(rolesDir, "reviewer.yaml"), "id: reviewer\nlabel: Reviewer\nallowedStages:\n  - review\ncapabilities:\n  - read_code\n  - review_code\n  - run_tests\n");
		updateWorkflowDraft(root, created.definition.id, { expectedRevision: draft.revision, actor: "human:owner", content });
		const published = publishWorkflowDraft(root, created.definition.id, { expectedRevision: draft.revision + 1, actor: "human:owner", reason: "Publish human gate resume workflow." });
		const workflowPath = join(getLetraDir(root), "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { workflowVersionId: published.id, workflowVersionNumber: published.number, claimedBy: "implementer", claimExecutorId: "codex", claimCapability: "write_code", claimExpiresAt: new Date(Date.now() + 60_000).toISOString() });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		configurePassageRuntimeBindings(root);
		const now = new Date().toISOString();
		const run = { id: "run-human-gate", workspaceId: root, itemId: "ITEM-1", binding: { actorId: "implementer", identityId: "implementer", roleId: "implementer", executorId: "codex" }, authorization: { kind: "manual" as const, actorId: "human:owner", referenceId: "grant-human-gate", grantedAt: now, revision: "sha256:grant" }, workflowVersionId: published.id, workflowStageId: "code", cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1, directionRevision: "sha256:direction", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "waiting-human" as const };
		createExecutionRun(root, run);
		const before = resolveAgentDirection(root, undefined, { runId: run.id });
		const decision = { itemId: "ITEM-1", decision: "approve" as const, actor: "human:owner", expectedRevision: before.revision, reason: "Human approved the review gate." };
		const proof = signLocalOperation(root, decision.actor, "gate.decision", { itemId: decision.itemId, decision: decision.decision, expectedRevision: decision.expectedRevision, reason: decision.reason });
		const approved = await decideGateOperation(root, { ...decision, proof });
		expect(approved).toMatchObject({ outcome: "accepted", reasonCode: "GATE_DECISION_RECORDED", nextDirection: { item: { stage: "review" } } });
		expect(JSON.parse(readFileSync(workflowPath, "utf8")).items[0].handoff).toMatchObject({ to: "reviewer", targetExecutorId: "opencode", targetIdentityId: "reviewer" });
		const waitingRun = readExecutionRuns(root).runs[0];
		expect(waitingRun).toMatchObject({ id: run.id, status: "queued", revision: 2, workflowStageId: "review", cycle: { number: 1, endedAt: expect.any(String) }, gateDecisions: [{ gateId: "human-review", decision: "approve", decidedBy: "human:owner" }] });

		const resumed = await claimOperation(root, { itemId: "ITEM-1", actor: "reviewer", executorId: "opencode", capability: "review_code", expectedRevision: approved.afterRevision, reason: "Resume after human approval." });
		expect(resumed).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED", nextDirection: { run: { id: run.id, status: "running" } } });
		expect(readExecutionRuns(root).runs[0]).toMatchObject({ id: run.id, status: "running", revision: 3, workflowStageId: "review", cycle: { number: 2, endedAt: null }, binding: { roleId: "reviewer", executorId: "opencode" } });
	});

	it("runs validation through the shared service and audits its result", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");

		const result = await runValidationOperation(root, {
			itemId: "ITEM-1",
			expectedRevision: before.revision,
			reason: "Verify workspace before completion.",
		});

		expect(result).toMatchObject({
			outcome: "accepted",
			beforeRevision: before.revision,
			reasonCode: "VALIDATION_COMPLETED",
			validation: expect.objectContaining({
				failed: 0,
			}),
		});
		expect(result.afterRevision).not.toBe(before.revision);
		expect(result.auditId).toMatch(/^log-/);
		const stored = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		expect(stored.items[0].validation).toMatchObject({
			schemaVersion: "1",
			outcome: "accepted",
			summary: { failed: 0 },
		});
	});

	it("returns a shared invalid-link envelope without creating a competing local authority", async () => {
		const root = mkdtempSync(join(tmpdir(), "letra-invalid-link-operation-"));
		roots.push(root);
		mkdirSync(join(root, ".letra"), { recursive: true });
		writeFileSync(join(root, ".letra-link"), "\n", "utf8");
		// A local workflow is deliberately present to prove the invalid link is
		// authoritative and cannot silently fall back to this directory.
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({ items: [] }), "utf8");

		const before = resolveAgentDirection(root, "ITEM-1");
		const result = await runValidationOperation(root, {
			itemId: "ITEM-1",
			expectedRevision: before.revision,
			reason: "Diagnose invalid workspace link.",
		});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "WORKSPACE_LINK_INVALID",
			beforeRevision: before.revision,
			afterRevision: before.revision,
			workspace: {
				code: "WORKSPACE_LINK_INVALID",
				recovery: expect.stringContaining("letra sync --mirror link-to-workspace"),
			},
		});
		expect(result.workspace?.paths).toContain(join(root, ".letra-link"));
		expect(existsSync(join(root, ".letra", "operations"))).toBe(false);
	});

	it("blocks every mutating gateway operation before reading the local projection", async () => {
		const root = mkdtempSync(join(tmpdir(), "letra-invalid-link-gateway-"));
		roots.push(root);
		mkdirSync(join(root, ".letra"), { recursive: true });
		writeFileSync(join(root, ".letra-link"), "missing-canonical-workspace\n", "utf8");
		const localWorkflow = JSON.stringify({ version: "local", items: [{ id: "LOCAL" }] }, null, 2);
		writeFileSync(join(root, ".letra", "workflow.json"), localWorkflow, "utf8");

		const before = resolveAgentDirection(root, "ITEM-1");
		const results = await Promise.all([
			createItemOperation(root, { id: "ITEM-NEW", description: "new", stage: "code", expectedRevision: before.revision, reason: "create", actor: "human:test" }),
			updateItemOperation(root, { itemId: "LOCAL", description: "changed", expectedRevision: before.revision, reason: "update", actor: "human:test" }),
			claimOperation(root, { itemId: "LOCAL", executorId: "test", capability: "write_code", expectedRevision: before.revision, reason: "claim", actor: "implementer" }),
			requestTransitionOperation(root, { itemId: "LOCAL", targetStageId: "review", expectedRevision: before.revision, reason: "transition", actor: "implementer" }),
			runValidationOperation(root, { expectedRevision: before.revision, reason: "validate" }),
		]);

		for (const result of results) {
			expect(result).toMatchObject({
				outcome: "rejected",
				reasonCode: "WORKSPACE_LINK_INVALID",
				beforeRevision: before.revision,
				afterRevision: before.revision,
				workspace: {
					code: "WORKSPACE_LINK_INVALID",
					paths: expect.arrayContaining([join(root, ".letra-link")]),
					recovery: expect.stringContaining("letra sync --mirror link-to-workspace"),
				},
			});
		}
		expect(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).toBe(localWorkflow);
		expect(existsSync(join(root, ".letra", "operations"))).toBe(false);
	});

	it("requires canonical passage after Code to Review validation", async () => {
		const root = fixture();
		configureHarness(root, "code-reviewed");
		writeFileSync(
			join(root, ".letra", "harness", "v0.2.0", "gates", "code-reviewed.yaml"),
			"id: code-reviewed\nname: Code reviewed\ntype: automated\nblocking: true\nstatus: pending\ncheck_type: validation\n",
		);
		const initial = resolveAgentDirection(root, "ITEM-1");
		const claimedWorkflow = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8"));
		Object.assign(claimedWorkflow.items[0], { claimedBy: "agent:test", claimExecutorId: "test", claimExpiresAt: new Date(Date.now() + 60_000).toISOString() });
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(claimedWorkflow, null, 2));
		const claimRevision = resolveAgentDirection(root, "ITEM-1").revision;
		const completed = completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: claimRevision,
			evidence: ["criterion complete"],
			reason: "Complete criterion before review.",
			actor: "agent:test",
			executorId: "test",
		});
		expect(completed).toMatchObject({ outcome: "accepted", reasonCode: "AC_COMPLETED" });
		const validation = await runValidationOperation(root, {
			itemId: "ITEM-1",
			expectedRevision: completed.afterRevision,
			reason: "Validate before review.",
			actor: "agent:test",
		});
		expect(validation).toMatchObject({ outcome: "accepted", reasonCode: "VALIDATION_COMPLETED" });
		const transition = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: validation.afterRevision,
			reason: "Request review immediately after validation.",
			actor: "agent:test",
		});
		expect(transition).toMatchObject({ outcome: "rejected", reasonCode: "CANONICAL_PASSAGE_REQUIRED" });
	});

	it("uses the same validation operation through the CLI command", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const cwd = process.cwd();
		const output: string[] = [];
		const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		try {
			process.chdir(root);
			await operationCommand().parseAsync([
				"validate", "--item", "ITEM-1", "--expected-revision", before.revision,
				"--reason", "CLI validation contract.",
			], { from: "user" });
		} finally {
			process.chdir(cwd);
			stdout.mockRestore();
		}
		expect(JSON.parse(output.join("") as string)).toMatchObject({
			outcome: "accepted",
			reasonCode: "VALIDATION_COMPLETED",
		});
		const stored = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		expect(stored.items[0].validation).toMatchObject({ outcome: "accepted" });
	});

	it("exposes expired-claim recovery as a revision-checked CLI operation", async () => {
		const root = fixture();
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
		Object.assign(workflow.items[0], { claimedBy: "implementer", claimExecutorId: "codex", claimCapability: "write_code", claimExpiresAt: new Date(Date.now() - 60_000).toISOString(), handoff: { from: "design", to: "implementer", summary: "Expired work assignment", evidence: ["prior-run"], timestamp: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString() } });
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root, "ITEM-1");
		const cwd = process.cwd();
		const output: string[] = [];
		const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { output.push(String(chunk)); return true; });
		try {
			process.chdir(root);
			await operationCommand().parseAsync(["reclaim-expired-claims", "--item", "ITEM-1", "--expected-revision", before.revision, "--reason", "Recover expired lease for the next canonical operation."], { from: "user" });
		} finally {
			process.chdir(cwd);
			stdout.mockRestore();
		}
		expect(JSON.parse(output.join(""))).toMatchObject({ outcome: "accepted", reasonCode: "CLAIMS_RECLAIMED" });
		const recoveredItem = JSON.parse(readFileSync(workflowPath, "utf8")).items[0];
		expect(recoveredItem).not.toHaveProperty("claimedBy");
		expect(recoveredItem).not.toHaveProperty("handoff");
		expect(recoveredItem.handoffHistory).toEqual([expect.objectContaining({ status: "expired", summary: "Expired work assignment" })]);
	});

	it("writes spec.md atomically — no .tmp files remain after completion", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root, "ITEM-1");
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim para teste." });

		completeAcOperation(root, {
			itemId: "ITEM-1",
			acId: "AC1",
			expectedRevision: claim.afterRevision,
			evidence: ["Atomic write verified"],
			reason: "Demonstrate atomic write.",
			actor: "agent:test",
			executorId: "test",
		});

		const specDir = join(root, ".letra", "specs", "controlled-operation");
		const specContent = readFileSync(join(specDir, "spec.md"), "utf-8");
		expect(specContent).toMatch(/- \[x\] \*\*AC1/);
		const files = readdirSync(specDir);
		expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
	});
});
