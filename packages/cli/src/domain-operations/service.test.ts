import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { loadSessionLog } from "../session-log.js";
import {
	completeAcOperation,
	requestTransitionOperation,
	runValidationOperation,
} from "./service.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-domain-operation-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "controlled-operation"), { recursive: true });
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
		version: "1.0",
		name: "Controlled operations",
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		stages: [
			{ id: "code", name: "Code", order: 0, zone: "doing" },
			{ id: "review", name: "Review", order: 1, zone: "doing" },
		],
		items: [{
			id: "ITEM-1",
			description: "Controlled operation",
			stage: "code",
			spec: "controlled-operation",
			createdAt: "2026-07-04T00:00:00.000Z",
		}],
		primaryItemId: "ITEM-1",
		tools: [],
	}, null, 2));
	writeFileSync(
		join(root, ".letra", "specs", "controlled-operation", "spec.md"),
		"# Spec\n\n## Outcome\n\nControlled operation with enough detail for validation.\n\n"
			+ "## Acceptance Criteria\n\n- [ ] **AC1**: operation is controlled\n",
	);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("domain operations", () => {
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
		});
		const withoutEvidence = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: [],
			reason: "Implementation completed.",
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

	it("completes only the current AC and returns the new canonical revision", () => {
		const root = fixture();
		const before = resolveAgentDirection(root);

		const result = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: ["Targeted tests: 12 passed", "Typecheck passed"],
			reason: "Acceptance criterion verified.",
		});

		expect(result).toMatchObject({
			outcome: "accepted",
			beforeRevision: before.revision,
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
		const rejected = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: initial.revision,
			reason: "Request review.",
		});
		expect(rejected).toMatchObject({
			outcome: "rejected",
			reasonCode: "PENDING_ACCEPTANCE_CRITERIA",
		});

		const completed = completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: initial.revision,
			evidence: ["Regression suite passed"],
			reason: "Criterion verified.",
		});
		const accepted = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: completed.afterRevision,
			reason: "Request review.",
		});

		expect(accepted).toMatchObject({
			outcome: "accepted",
			beforeRevision: completed.afterRevision,
			reasonCode: "TRANSITION_COMPLETED",
		});
		expect(accepted.nextDirection.item).toMatchObject({ id: "ITEM-1", stage: "review" });
		expect(accepted.afterRevision).not.toBe(completed.afterRevision);
	});

	it("returns approval-required without crossing a blocking human gate", async () => {
		const root = fixture();
		const initial = resolveAgentDirection(root);
		completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: initial.revision,
			evidence: ["Regression suite passed"],
			reason: "Criterion verified.",
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
		writeFileSync(join(harness, "flows", "controlled-flow.yaml"), [
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
			"  - id: review",
			"    name: Review",
			"    order: 1",
			"    zone: doing",
			"    gate: gates/human-review.yaml",
		].join("\n"));
		writeFileSync(join(harness, "gates", "human-review.yaml"), [
			"id: human-review",
			"name: Human Review",
			"type: human",
			"blocking: true",
			"description: explicit human approval",
		].join("\n"));

		const beforeRequest = resolveAgentDirection(root);
		const result = await requestTransitionOperation(root, {
			itemId: "ITEM-1",
			targetStageId: "review",
			expectedRevision: beforeRequest.revision,
			reason: "Request review.",
		});

		expect(result).toMatchObject({
			outcome: "approval-required",
			reasonCode: "HUMAN_APPROVAL_REQUIRED",
			beforeRevision: beforeRequest.revision,
			afterRevision: beforeRequest.revision,
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
			afterRevision: before.revision,
			reasonCode: "VALIDATION_COMPLETED",
			validation: expect.objectContaining({
				failed: 0,
			}),
		});
		expect(result.auditId).toMatch(/^log-/);
	});

	it("writes spec.md atomically — no .tmp files remain after completion", () => {
		const root = fixture();
		const before = resolveAgentDirection(root);

		completeAcOperation(root, {
			acId: "AC1",
			expectedRevision: before.revision,
			evidence: ["Atomic write verified"],
			reason: "Demonstrate atomic write.",
		});

		const specDir = join(root, ".letra", "specs", "controlled-operation");
		const specContent = readFileSync(join(specDir, "spec.md"), "utf-8");
		expect(specContent).toMatch(/- \[x\] \*\*AC1/);
		const files = readdirSync(specDir);
		expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
	});
});
