import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { loadSessionLog } from "../session-log.js";
import {
	completeAcOperation,
	activateWorkOperation,
	createItemOperation,
	updateItemOperation,
	requestHandoffOperation,
	requestTransitionOperation,
	requestReworkOperation,
	runValidationOperation,
	claimOperation,
	runSecurityReviewOperation,
} from "./service.js";
import operationCommand from "../commands/operation.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-domain-operation-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "controlled-operation"), { recursive: true });
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

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("domain operations", () => {
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
		const before = resolveAgentDirection(root);
		const allowedStage = await runSecurityReviewOperation(root, { itemId: "ITEM-1", executorId: "scanner", actor: "sentinel", expectedRevision: before.revision, reason: "Configured scan." });
		expect(allowedStage.reasonCode).toBe("CLAIM_REQUIRED");
		writeFileSync(flowPath, readFileSync(flowPath, "utf8").replace("      - nebula", "      - other").replace("agents: [\"implementer\"]", "agents: [\"security\"]"));
		const deniedRevision = resolveAgentDirection(root).revision;
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
		const before = resolveAgentDirection(root);
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
			const before = resolveAgentDirection(root);
			const result = await requestTransitionOperation(root, { itemId: "ITEM-1", targetStageId: "review", actor: "human:owner", expectedRevision: before.revision, reason: "Exercise hook policy." });
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
		const before = resolveAgentDirection(root);
		const result = await activateWorkOperation(root, { itemId: "ITEM-1", actor: "human:owner", expectedRevision: before.revision, reason: "Prioridade confirmada." });
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "WORK_ACTIVATED" });
		const stored = JSON.parse(readFileSync(workflowPath, "utf-8"));
		expect(stored.items[0]).toMatchObject({ stage: "design", handoff: { from: "human:owner", to: "analyst" } });
	});

	it("rejects stale revisions and missing regression evidence without changing the spec", () => {
		const root = fixture();
		const before = resolveAgentDirection(root);
		const specPath = join(root, ".letra", "specs", "controlled-operation", "spec.md");
		const original = readFileSync(specPath, "utf-8");

		const stale = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: "sha256:stale",
			evidence: ["61 focused tests passed"],
			reason: "Implementation completed.",
			actor: "agent:test",
		});
		const withoutEvidence = completeAcOperation(root, {
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

	it("completes only the current AC and returns the new canonical revision", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root);
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim para teste." });
		expect(claim.outcome).toBe("accepted");

		const result = completeAcOperation(root, {
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

	it("rejects transition with pending ACs and accepts it after completion", async () => {
		const root = fixture();
		const initial = resolveAgentDirection(root);
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
		});

		const completed = completeAcOperation(root, {
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

		expect(accepted).toMatchObject({
			outcome: "accepted",
			beforeRevision: completed.afterRevision,
			reasonCode: "TRANSITION_COMPLETED",
		});
		expect(accepted.nextDirection.item).toMatchObject({ id: "ITEM-1", stage: "review" });
		expect(accepted.afterRevision).not.toBe(completed.afterRevision);
	});

	it("requires actor identity for AC completion and transitions", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root);
		const complete = completeAcOperation(root, {
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
		writeFileSync(
			join(root, ".letra", "harness", "v0.2.0", "gates", "review-gate.yaml"),
			"id: review-gate\nname: Review Gate\ntype: automated\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
		);
		const before = resolveAgentDirection(root);
		const claimed = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		claimed.items[0].claimedBy = "agent:test";
		claimed.items[0].claimExecutorId = "executor:test";
		claimed.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(claimed, null, 2));
		const current = resolveAgentDirection(root);
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1",
			to: "reviewer",
			executorId: "executor:test",
			summary: "Ready for review",
			evidence: ["tests passed"],
			expectedRevision: current.revision,
			reason: "Request gated handoff.",
			actor: "agent:test",
		});
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "BLOCKING_GATE" });
		const after = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf-8"));
		expect(after.items[0]).toMatchObject({ claimedBy: "agent:test" });
		expect(after.items[0].handoff).toBeUndefined();
	});

	it("replaces the inbound handoff when its actor completes the claimed stage", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		workflow.items[0].claimedBy = "agent:test";
		workflow.items[0].claimExecutorId = "executor:test";
		workflow.items[0].claimExpiresAt = new Date(Date.now() + 60_000).toISOString();
		workflow.items[0].handoff = { from: "design", to: "agent:test", summary: "Incoming", evidence: [], timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), executorId: "executor:test" };
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root);
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1", to: "reviewer", executorId: "executor:test", summary: "Outgoing", evidence: ["tests passed"],
			expectedRevision: before.revision, reason: "Advance to review.", actor: "agent:test",
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "HANDOFF_ACCEPTED" });
		const after = JSON.parse(readFileSync(workflowPath, "utf-8"));
		expect(after.items[0].handoff).toMatchObject({ from: "agent:test", to: "reviewer" });
		expect(after.items[0]).not.toHaveProperty("claimedBy");
		expect(after.items[0]).not.toHaveProperty("claimExecutorId");
		expect(after.items[0]).not.toHaveProperty("claimExpiresAt");
	});

	it("replaces an expired handoff so a completed claim can reach the next actor", async () => {
		const root = fixture();
		configureHarness(root);
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
		Object.assign(workflow.items[0], {
			claimedBy: "agent:test",
			claimExecutorId: "executor:test",
			claimExpiresAt: new Date(Date.now() + 60_000).toISOString(),
			handoff: { from: "old-executor", to: "reviewer", summary: "expired", evidence: [], timestamp: "2026-09-10T10:00:00.000Z", expiresAt: "2026-09-10T10:01:00.000Z" },
		});
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		const before = resolveAgentDirection(root);
		const result = await requestHandoffOperation(root, {
			itemId: "ITEM-1", to: "reviewer", executorId: "executor:test", actor: "agent:test",
			summary: "Fresh handoff", evidence: ["tests passed"], expectedRevision: before.revision, reason: "Substituir handoff expirado.",
		});
		expect(result).toMatchObject({ outcome: "accepted", reasonCode: "HANDOFF_ACCEPTED" });
		const persisted = JSON.parse(readFileSync(workflowPath, "utf8")).items[0];
		expect(persisted.handoff).toMatchObject({ from: "agent:test", to: "reviewer", summary: "Fresh handoff" });
	});

	it("rejects a claim from an actor that is not assigned to the current stage", async () => {
		const root = fixture();
		configureHarness(root);
		const before = resolveAgentDirection(root);
		const result = await (await import("./service.js")).claimOperation(root, {
			itemId: "ITEM-1", actor: "reviewer", executorId: "executor:test", capability: "read_code",
			expectedRevision: before.revision, reason: "Invalid actor claim.",
		});
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED" });
	});

	it("allows the handoff that enters a stage with an exit gate", async () => {
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
		const before = resolveAgentDirection(root);
		const transition = await requestTransitionOperation(root, { itemId: "ITEM-1", targetStageId: "security", actor: "agent:test", expectedRevision: before.revision, reason: "Enter security." });
		expect(transition.outcome).toBe("accepted");
		const handoff = await requestHandoffOperation(root, { itemId: "ITEM-1", to: "security", executorId: "executor:test", summary: "Security scan ready.", evidence: ["scan"], expectedRevision: transition.afterRevision, reason: "Assign security scan.", actor: "agent:test" });
		expect(handoff).toMatchObject({ outcome: "accepted", reasonCode: "HANDOFF_ACCEPTED" });
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
		const before = resolveAgentDirection(root);
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
		const before = resolveAgentDirection(root);
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
		const before = resolveAgentDirection(root);
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

	it("returns approval-required without crossing a blocking human gate", async () => {
		const root = fixture();
		const initial = resolveAgentDirection(root);
		completeAcOperation(root, {
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

		const beforeRequest = resolveAgentDirection(root);
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: beforeRequest.revision, reason: "Claim para teste." });
		const completed = completeAcOperation(root, { acId: "AC1", expectedRevision: claim.afterRevision, evidence: ["Gate regression criterion complete"], reason: "Criterion verified.", actor: "agent:test", executorId: "test" });
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
		expect(resolveAgentDirection(root).item).toMatchObject({ stage: "code" });
	});

	it("runs validation through the shared service and audits its result", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root);

		const result = await runValidationOperation(root, {
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

		const before = resolveAgentDirection(root);
		const result = await runValidationOperation(root, {
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

		const before = resolveAgentDirection(root);
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

it("accepts Code to Review immediately after the canonical validation evidence is written", async () => {
		const root = fixture();
		configureHarness(root, "code-reviewed");
		writeFileSync(
			join(root, ".letra", "harness", "v0.2.0", "gates", "code-reviewed.yaml"),
			"id: code-reviewed\nname: Code reviewed\ntype: automated\nblocking: true\nstatus: pending\ncheck_type: validation\n",
		);
		const initial = resolveAgentDirection(root);
		const claimedWorkflow = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8"));
		Object.assign(claimedWorkflow.items[0], { claimedBy: "agent:test", claimExecutorId: "test", claimExpiresAt: new Date(Date.now() + 60_000).toISOString() });
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(claimedWorkflow, null, 2));
		const claimRevision = resolveAgentDirection(root).revision;
		const completed = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: claimRevision,
			evidence: ["criterion complete"],
			reason: "Complete criterion before review.",
			actor: "agent:test",
			executorId: "test",
		});
		expect(completed).toMatchObject({ outcome: "accepted", reasonCode: "AC_COMPLETED" });
		const validation = await runValidationOperation(root, {
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
		expect(transition).toMatchObject({ outcome: "accepted", reasonCode: "TRANSITION_COMPLETED" });
	});

	it("uses the same validation operation through the CLI command", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root);
		const cwd = process.cwd();
		const output: string[] = [];
		const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		try {
			process.chdir(root);
			await operationCommand().parseAsync([
				"validate", "--expected-revision", before.revision,
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

	it("writes spec.md atomically — no .tmp files remain after completion", async () => {
		const root = fixture();
		const before = resolveAgentDirection(root);
		const claim = await claimOperation(root, { itemId: "ITEM-1", executorId: "test", capability: "write_code", actor: "agent:test", expectedRevision: before.revision, reason: "Claim para teste." });

		completeAcOperation(root, {
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
