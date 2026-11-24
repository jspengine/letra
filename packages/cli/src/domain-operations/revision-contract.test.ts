/**
 * ITEM-39 AC1: every item operation compares the single canonical direction
 * (resolveOperationDirection). With a stale revision each operation must
 * refuse with DIRECTION_STALE and report, as the current direction, exactly
 * the canonical one, so a client that consults it once can retry correctly.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveFallbackDirection } from "../agent-direction/fallback.js";
import { resolveDirection, resolveOperationDirection } from "../agent-direction/service.js";
import { withDirectionScope } from "../commands/direction.js";
import { claimCanonically } from "../test/canonical-claim.js";
import { createWorkflowDefinition, publishWorkflowDraft } from "../workflow-versions/service.js";
import { ensureSharedHarness } from "../workspace/resolution.js";
import {
	activateWorkOperation,
	claimOperation,
	completeAcOperation,
	deleteItemOperation,
	type OperationResult,
	recordExecutionEvent,
	releaseClaimOperation,
	requestPassageOperation,
	requestReworkOperation,
	requestTransitionOperation,
	rollbackHandoffOperation,
	runSecurityReviewOperation,
	submitEvidenceOperation,
	updateItemOperation,
} from "./service.js";

const STALE = "sha256:stale-revision";
let root: string;

beforeAll(async () => {
	ensureSharedHarness("v0.2.0");
	root = mkdtempSync(join(tmpdir(), "letra-revision-contract-"));
	mkdirSync(join(root, "specs", "contract"), { recursive: true });
	mkdirSync(join(root, "identity"), { recursive: true });
	writeFileSync(join(root, "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test", createdAt: new Date().toISOString() }));
	writeFileSync(join(root, "specs", "contract", "spec.md"), "# Spec\n\n## Acceptance Criteria\n- [ ] **AC1**: contract\n");
	mkdirSync(join(root, "specs", "chain"), { recursive: true });
	writeFileSync(join(root, "specs", "chain", "spec.md"), "# Spec\n\n## Acceptance Criteria\n- [ ] **AC1**: chain\n");
	writeFileSync(
		join(root, "workflow.json"),
		JSON.stringify({
			version: "1.0",
			name: "Contract",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			harnessVersion: "v0.2.0",
			stages: [
				{ id: "work", name: "Work", order: 0, zone: "doing" },
				{ id: "review", name: "Review", order: 1, zone: "doing" },
				{ id: "done", name: "Done", order: 2, zone: "done" },
			],
			items: [
				{ id: "ITEM-1", description: "Contract item", stage: "work", spec: "contract", createdAt: "2026-01-01T00:00:00.000Z" },
				{ id: "ITEM-2", description: "Chain item", stage: "work", spec: "chain", createdAt: "2026-01-01T00:00:00.000Z" },
				{ id: "ITEM-3", description: "Second active Run", stage: "work", spec: "contract", createdAt: "2026-01-01T00:00:00.000Z" },
			],
			tools: [],
		}),
	);
	// The claim opens a Run only for an item pinned to a published version.
	const { definition, draft } = createWorkflowDefinition(root, {
		name: "Contract flow",
		actor: "human:owner",
		content: {
			name: "Contract flow",
			initialStageId: "work",
			stages: [
				{ id: "work", name: "Work", zone: "doing", allow: ["implementer"], transitions: [{ target: "review" }] },
				{ id: "review", name: "Review", zone: "doing", allow: ["reviewer"], transitions: [{ target: "done" }] },
				{ id: "done", name: "Done", zone: "done", final: true },
			],
		},
	});
	publishWorkflowDraft(root, definition.id, { expectedRevision: draft.revision, actor: "human:owner", reason: "Publish contract flow." });
	// An active Run is the case where the directions used to diverge.
	await claimCanonically(root, { itemId: "ITEM-1", actor: "implementer", executorId: "codex", capability: "write_code" });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const base = { itemId: "ITEM-1", expectedRevision: STALE, reason: "Revision contract." };
const operations: Array<[string, () => Promise<OperationResult> | OperationResult]> = [
	["claim", () => claimOperation(root, { ...base, actor: "implementer", executorId: "codex", capability: "write_code" })],
	["execution event", () => recordExecutionEvent(root, { ...base, actor: "implementer", executorId: "codex", status: "heartbeat" })],
	["evidence", () => submitEvidenceOperation(root, { ...base, actor: "implementer", executorId: "codex", evidence: [{ kind: "test", value: "contract", source: "test" }] })],
	["complete_ac", () => completeAcOperation(root, { ...base, actor: "implementer", executorId: "codex", acId: "AC1", evidence: ["contract"] })],
	["passage", () => requestPassageOperation(root, { ...base, actor: "implementer", executorId: "codex", to: "reviewer", summary: "s", evidence: [] })],
	["release", () => releaseClaimOperation(root, { ...base, actor: "implementer" })],
	["rollback handoff", () => rollbackHandoffOperation(root, { ...base, actor: "implementer" })],
	["rework", () => requestReworkOperation(root, { ...base, actor: "reviewer", acceptanceCriteria: [{ description: "x" }] })],
	["transition", () => requestTransitionOperation(root, { ...base, actor: "implementer", targetStageId: "review" })],
	["security review", () => runSecurityReviewOperation(root, { ...base, actor: "security", executorId: "codex" })],
	["update item", () => updateItemOperation(root, { ...base, actor: "implementer", description: "x" })],
	["delete item", () => deleteItemOperation(root, { ...base, actor: "implementer" })],
	["activate work", () => activateWorkOperation(root, { ...base, actor: "human:owner" })],
];

describe("canonical revision contract (ITEM-39 AC1)", () => {
	it("compares the assigned Run direction while the item has an active Run", () => {
		const canonical = resolveOperationDirection(root, { itemId: "ITEM-1" });
		expect(canonical.assignment).toMatchObject({ status: "assigned" });
	});

	// ITEM-39 AC3: `letra direction --item/--run` (fallback) and MCP
	// `get_direction` (resolveDirection) return the revision operations compare.
	it("returns the compared revision from every direction query", () => {
		const canonical = resolveOperationDirection(root, { itemId: "ITEM-1" });
		const runId = canonical.assignment?.runId;
		expect(runId).toBeTruthy();
		expect(resolveDirection(root, { itemId: "ITEM-1" }).revision).toBe(canonical.revision);
		expect(resolveDirection(root, { runId }).revision).toBe(canonical.revision);
		expect(resolveFallbackDirection(root, { itemId: "ITEM-1" }).revision).toBe(canonical.revision);
		expect(resolveFallbackDirection(root, { runId }).revision).toBe(canonical.revision);
	});

	// ITEM-39 AC2: the afterRevision of each accepted operation is the
	// expectedRevision of the next one; no direction lookup in between.
	it("chains afterRevision through claim, heartbeat, evidence, complete_ac, passage, next claim and release", async () => {
		const accept = (result: OperationResult, code: string) => {
			expect([result.outcome, result.reasonCode, result.reason]).toEqual(["accepted", code, expect.anything()]);
			return result.afterRevision;
		};
		let revision = resolveOperationDirection(root, { itemId: "ITEM-2" }).revision;
		const item = { itemId: "ITEM-2", reason: "Chain." };
		revision = accept(await claimOperation(root, { ...item, expectedRevision: revision, actor: "implementer", executorId: "codex", capability: "write_code" }), "CLAIM_ACCEPTED");
		revision = accept(await recordExecutionEvent(root, { ...item, expectedRevision: revision, actor: "implementer", executorId: "codex", status: "heartbeat" }), "EVENT_RECORDED");
		revision = accept(await submitEvidenceOperation(root, { ...item, expectedRevision: revision, actor: "implementer", executorId: "codex", evidence: [{ kind: "test", value: "chain test", source: "test" }] }), "EVIDENCE_ACCEPTED");
		revision = accept(await completeAcOperation(root, { ...item, expectedRevision: revision, actor: "implementer", executorId: "codex", acId: "AC1", evidence: ["chain test"] }), "AC_COMPLETED");
		revision = accept(await requestPassageOperation(root, { ...item, expectedRevision: revision, actor: "implementer", executorId: "codex", to: "reviewer", summary: "Ready for review.", evidence: [] }), "PASSAGE_COMPLETED");
		revision = accept(await claimOperation(root, { ...item, expectedRevision: revision, actor: "reviewer", executorId: "codex", capability: "review_code" }), "CLAIM_ACCEPTED");
		accept(await releaseClaimOperation(root, { ...item, expectedRevision: revision, actor: "reviewer" }), "CLAIM_RELEASED");
	});

	// ITEM-39 AC5: the refusal names the compared scope, the current revision
	// and the exact command to read it.
	it("explains a stale revision with scope, current revision and command", async () => {
		const canonical = resolveOperationDirection(root, { itemId: "ITEM-1" });
		const runId = canonical.assignment?.runId as string;
		const result = await releaseClaimOperation(root, { ...base, actor: "implementer" });
		expect(result.reasonCode).toBe("DIRECTION_STALE");
		expect(result.reason).toContain(`Run ${runId}`);
		expect(result.reason).toContain(canonical.revision);
		expect(result.reason).toContain(`letra direction --run ${runId} --json`);
		expect(result.recoveryActions?.join(" ")).toContain(`letra direction --run ${runId} --json`);
	});

	// ITEM-39 AC4 (ITEM-29): a workspace revision sent to an item operation is
	// called out as such, and `letra direction` without a target says it is the
	// workspace direction.
	// With two active Runs, the targetless direction is the workspace one
	// (selection-required); with exactly one it is that Run's direction.
	const ensureSecondRun = async () => {
		if (resolveOperationDirection(root, { itemId: "ITEM-3" }).assignment?.status === "assigned") return;
		await claimCanonically(root, { itemId: "ITEM-3", actor: "implementer", executorId: "codex-2", capability: "write_code" });
	};

	it("calls out a workspace revision sent to an item operation", async () => {
		await ensureSecondRun();
		const workspaceRevision = resolveOperationDirection(root, {}).revision;
		const result = await releaseClaimOperation(root, { ...base, expectedRevision: workspaceRevision, actor: "implementer" });
		expect(result.reasonCode).toBe("DIRECTION_STALE");
		expect(result.reason).toContain("direção de workspace");
	});

	it("labels the direction scope for `letra direction`", async () => {
		await ensureSecondRun();
		const workspace = withDirectionScope(resolveOperationDirection(root, {}));
		expect(workspace.scope).toBe("workspace");
		expect(workspace.warnings.map((warning) => warning.code)).toContain("DIRECTION_SCOPE_WORKSPACE");
		const run = withDirectionScope(resolveOperationDirection(root, { itemId: "ITEM-1" }), "ITEM-1");
		expect(run.scope).toBe("run");
		expect(run.warnings.map((warning) => warning.code)).not.toContain("DIRECTION_SCOPE_WORKSPACE");
	});

	it.each(operations)("%s refuses a stale revision with the canonical direction", async (_name, call) => {
		const canonical = resolveOperationDirection(root, { itemId: "ITEM-1" });
		const result = await call();
		expect(result.outcome).toBe("rejected");
		expect(result.reasonCode).toBe("DIRECTION_STALE");
		expect(result.nextDirection.revision).toBe(canonical.revision);
	});
});
