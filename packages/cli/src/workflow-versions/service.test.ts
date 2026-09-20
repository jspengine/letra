import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createWorkflowDefinition,
	createWorkflowDraft,
	discardWorkflowDraft,
	getActiveWorkflowVersion,
	getWorkflowDraft,
	getWorkflowVersion,
	listWorkflowDraftRevisions,
	listWorkflowVersions,
	publishWorkflowDraft,
	rollbackWorkflowVersion,
	updateWorkflowDraft,
	validateWorkflowContent,
} from "./service.js";

const roots: string[] = [];
function root(): string { const value = mkdtempSync(join(tmpdir(), "letra-workflow-version-")); roots.push(value); mkdirSync(join(value, ".letra"), { recursive: true }); return value; }
const valid = (name = "Flow") => ({ name, initialStageId: "start", stages: [{ id: "start", transitions: [{ target: "done" }] }, { id: "done", final: true }] });
afterEach(() => { for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true }); });

describe("versioned workflow definitions", () => {
	it("creates an isolated draft without activating a version", () => { const created = createWorkflowDefinition(root(), { name: "New", actor: "human:owner" }); expect(created.definition.activeVersionId).toBeNull(); expect(created.draft.status).toBe("draft"); });
	it("updates drafts optimistically and keeps published snapshots immutable", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); const updated = updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", content: valid("Changed") }); expect(updated.revision).toBe(2); expect(() => updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", content: valid("Lost") })).toThrow(/DRAFT_REVISION_CONFLICT/); const published = publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 2, actor: "human:owner", reason: "Release" }); createWorkflowDraft(workspace, created.definition.id, "human:owner"); const next = getWorkflowDraft(workspace, created.definition.id); updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: next.revision, actor: "human:owner", content: valid("Next") }); expect(getWorkflowVersion(workspace, created.definition.id, published.number!).content.name).toBe("Changed"); });
	it("blocks invalid publication and leaves active state unchanged", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Broken", actor: "human:owner" }); expect(validateWorkflowContent(created.draft.content).valid).toBe(false); expect(() => publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Bad" })).toThrow(/WORKFLOW_INVALID/); const index = JSON.parse(readFileSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "index.json"), "utf8")); expect(index.activeVersionId).toBeNull(); expect(existsSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "draft.json"))).toBe(true); });
	it("publishes immutable sequential versions with hashes and human audit identity", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); const version = publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:publisher", reason: "Approved" }); expect(version).toMatchObject({ number: 1, status: "published", publishedBy: "human:publisher", changeSummary: "Approved" }); expect(version.contentHash).toMatch(/^[a-f0-9]{64}$/); expect(listWorkflowVersions(workspace, created.definition.id)).toHaveLength(1); });
	it("rolls back by publishing a new version without modifying history", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid("V1") }); const v1 = publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "V1" }); const draft = createWorkflowDraft(workspace, created.definition.id, "human:owner"); updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: draft.revision, actor: "human:owner", content: valid("V2") }); publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 2, actor: "human:owner", reason: "V2" }); const restored = rollbackWorkflowVersion(workspace, created.definition.id, { versionNumber: 1, actor: "human:owner", reason: "Restore stable" }); expect(restored.number).toBe(3); expect(restored.restoredFromVersionId).toBe(v1.id); expect(restored.content.name).toBe("V1"); const v1AfterV2 = getWorkflowVersion(workspace, created.definition.id, 1); expect(v1AfterV2).toMatchObject({ id: v1.id, number: 1, content: v1.content, contentHash: v1.contentHash, publishedBy: v1.publishedBy, publishedAt: v1.publishedAt, status: "superseded" }); expect(v1AfterV2.status).toBe("superseded"); });
	it("requires explicit human publication and rollback", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); expect(() => publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "implementer", reason: "Self approve" })).toThrow(/HUMAN_PUBLICATION_REQUIRED/); });
	it("rejects unsafe workflow identifiers and version numbers before filesystem access", () => { const workspace = root(); expect(() => getWorkflowVersion(workspace, "../escape", 1)).toThrow(/WORKFLOW_ID_INVALID/); expect(() => getWorkflowVersion(workspace, "workflow-safe", Number.NaN)).toThrow(/WORKFLOW_VERSION_INVALID/); expect(() => getWorkflowVersion(workspace, "workflow-safe", 0)).toThrow(/WORKFLOW_VERSION_INVALID/); expect(existsSync(join(workspace, "escape"))).toBe(false); });
	it("preserves queryable draft revision history", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid("R1") }); updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", content: valid("R2") }); updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: 2, actor: "human:owner", content: valid("R3") }); expect(listWorkflowDraftRevisions(workspace, created.definition.id).map((draft) => draft.revision)).toEqual([1, 2, 3]); });
	it("derives superseded lifecycle without mutating immutable snapshots", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid("V1") }); const first = publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "V1" }); const original = readFileSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "versions", "v1.json"), "utf8"); const draft = createWorkflowDraft(workspace, created.definition.id, "human:owner"); updateWorkflowDraft(workspace, created.definition.id, { expectedRevision: draft.revision, actor: "human:owner", content: valid("V2") }); publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 2, actor: "human:owner", reason: "V2" }); expect(listWorkflowVersions(workspace, created.definition.id).map((version) => version.status)).toEqual(["superseded", "published"]); expect(getActiveWorkflowVersion(workspace, created.definition.id)?.number).toBe(2); expect(readFileSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "versions", "v1.json"), "utf8")).toBe(original); expect(first.status).toBe("published"); });
	it("rejects unreachable stages semantically", () => { const result = validateWorkflowContent({ name: "Broken", initialStageId: "start", stages: [{ id: "start", final: true }, { id: "orphan", final: true }] }); expect(result.errors).toContainEqual(expect.objectContaining({ code: "STAGE_UNREACHABLE" })); });
	it("rolls back snapshot and activation when publication fails after index swap", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); expect(() => publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "Fault" }, { afterActivation: () => { throw new Error("injected"); } })).toThrow("injected"); expect(getActiveWorkflowVersion(workspace, created.definition.id)).toBeNull(); expect(getWorkflowDraft(workspace, created.definition.id).revision).toBe(1); expect(listWorkflowVersions(workspace, created.definition.id)).toEqual([]); });
	it("recovers an uncommitted publication journal by restoring draft and index", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); const dir = join(workspace, ".letra", "workflow-definitions", created.definition.id); const published = { ...created.draft, id: "version-recover-rollback", number: 1, status: "published", publishedBy: "human:owner", publishedAt: new Date().toISOString(), changeSummary: "Crash" }; writeFileSync(join(dir, "versions", "v1.json"), JSON.stringify(published, null, 2), "utf8"); writeFileSync(join(dir, "publication.transaction.json"), JSON.stringify({ operation: "publish", workflowId: created.definition.id, number: 1, previousVersionId: null, draft: created.draft, published, originalDefinition: created.definition, startedAt: new Date().toISOString(), actor: "human:owner", reason: "Crash" }, null, 2), "utf8"); expect(getActiveWorkflowVersion(workspace, created.definition.id)).toBeNull(); expect(getWorkflowDraft(workspace, created.definition.id).id).toBe(created.draft.id); expect(existsSync(join(dir, "versions", "v1.json"))).toBe(false); expect(existsSync(join(dir, "publication.transaction.json"))).toBe(false); });
	it("recovers a committed publication journal by finalizing activation", () => { const workspace = root(); const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() }); const dir = join(workspace, ".letra", "workflow-definitions", created.definition.id); const now = new Date().toISOString(); const published = { ...created.draft, id: "version-recover-commit", number: 1, status: "published", publishedBy: "human:owner", publishedAt: now, changeSummary: "Crash" }; const committed = { ...created.definition, activeVersionId: published.id, draftVersionId: null, nextVersionNumber: 2, updatedAt: now }; writeFileSync(join(dir, "versions", "v1.json"), JSON.stringify(published, null, 2), "utf8"); writeFileSync(join(dir, "index.json"), JSON.stringify(committed, null, 2), "utf8"); writeFileSync(join(dir, "publication.transaction.json"), JSON.stringify({ operation: "publish", workflowId: created.definition.id, number: 1, previousVersionId: null, draft: created.draft, published, originalDefinition: created.definition, startedAt: now, actor: "human:owner", reason: "Crash" }, null, 2), "utf8"); expect(getActiveWorkflowVersion(workspace, created.definition.id)?.id).toBe(published.id); expect(existsSync(join(dir, "draft.json"))).toBe(false); expect(existsSync(join(dir, "publication.transaction.json"))).toBe(false); });
	
	it("rolls back draft creation when an error occurs before index commit", () => {
		const workspace = root();
		const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() });
		publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "v1" });
		
		expect(() => createWorkflowDraft(workspace, created.definition.id, "human:owner", undefined, {
			beforeCommit: () => { throw new Error("crash before commit"); },
		})).toThrow("crash before commit");

		const def = JSON.parse(readFileSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "index.json"), "utf8"));
		expect(def.draftVersionId).toBeNull();
		expect(existsSync(join(workspace, ".letra", "workflow-definitions", created.definition.id, "draft.json"))).toBe(false);
	});

	it("recovers an uncommitted draft creation journal by rolling back", () => {
		const workspace = root();
		const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() });
		publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "v1" });
		const dir = join(workspace, ".letra", "workflow-definitions", created.definition.id);

		const fakeDraft = { ...created.draft, id: "draft-crashed" };
		writeFileSync(join(dir, "draft.json"), JSON.stringify(fakeDraft), "utf8");
		writeFileSync(join(dir, "draft.transaction.json"), JSON.stringify({
			operation: "create_draft",
			workflowId: created.definition.id,
			draftId: fakeDraft.id,
			draft: fakeDraft,
			originalDefinition: { ...created.definition, activeVersionId: "v1", draftVersionId: null },
			updatedDefinition: { ...created.definition, activeVersionId: "v1", draftVersionId: fakeDraft.id },
			startedAt: new Date().toISOString(),
			actor: "human:owner",
		}), "utf8");

		expect(() => getWorkflowDraft(workspace, created.definition.id)).toThrow(/WORKFLOW_DRAFT_NOT_FOUND/);
		expect(existsSync(join(dir, "draft.json"))).toBe(false);
		expect(existsSync(join(dir, "draft.transaction.json"))).toBe(false);
	});

	it("recovers a committed draft creation journal by finalizing draft state", () => {
		const workspace = root();
		const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() });
		publishWorkflowDraft(workspace, created.definition.id, { expectedRevision: 1, actor: "human:owner", reason: "v1" });
		const dir = join(workspace, ".letra", "workflow-definitions", created.definition.id);

		const fakeDraft = { ...created.draft, id: "draft-committed" };
		const committedDef = { ...created.definition, activeVersionId: "v1", draftVersionId: fakeDraft.id };
		writeFileSync(join(dir, "draft.json"), JSON.stringify(fakeDraft), "utf8");
		writeFileSync(join(dir, "index.json"), JSON.stringify(committedDef), "utf8");
		writeFileSync(join(dir, "draft.transaction.json"), JSON.stringify({
			operation: "create_draft",
			workflowId: created.definition.id,
			draftId: fakeDraft.id,
			draft: fakeDraft,
			originalDefinition: { ...created.definition, activeVersionId: "v1", draftVersionId: null },
			updatedDefinition: committedDef,
			startedAt: new Date().toISOString(),
			actor: "human:owner",
		}), "utf8");

		const recovered = getWorkflowDraft(workspace, created.definition.id);
		expect(recovered.id).toBe(fakeDraft.id);
		expect(existsSync(join(dir, "draft-revisions", "r1.json"))).toBe(true);
		expect(existsSync(join(dir, "draft.transaction.json"))).toBe(false);
	});

	it("discards workflow draft transactionally with recovery support", () => {
		const workspace = root();
		const created = createWorkflowDefinition(workspace, { name: "Main", actor: "human:owner", content: valid() });
		const dir = join(workspace, ".letra", "workflow-definitions", created.definition.id);

		expect(existsSync(join(dir, "draft.json"))).toBe(true);
		discardWorkflowDraft(workspace, created.definition.id, "human:owner");

		expect(existsSync(join(dir, "draft.json"))).toBe(false);
		expect(() => getWorkflowDraft(workspace, created.definition.id)).toThrow(/WORKFLOW_DRAFT_NOT_FOUND/);
		const def = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
		expect(def.draftVersionId).toBeNull();
	});

	// ─── Gap 6: Semantic validation ────────────────────────────────────────────

	it("detects deadlock: non-final stage with no path to a final stage", () => {
		const result = validateWorkflowContent({
			name: "Deadlock",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "loop" }] },
				{ id: "loop", transitions: [{ target: "start" }] }, // cycle, no final reachable
				{ id: "done", final: true },
			],
		});
		expect(result.errors.some((e) => ["STAGE_UNREACHABLE", "FINAL_STAGE_UNREACHABLE"].includes(e.code))).toBe(true);
	});

	it("detects FINAL_STAGE_UNREACHABLE for stages that cannot reach any final stage", () => {
		const result = validateWorkflowContent({
			name: "Cycle",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "a" }] },
				{ id: "a", transitions: [{ target: "b" }] },
				{ id: "b", transitions: [{ target: "a" }] }, // cycle — no way to reach done
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "FINAL_STAGE_UNREACHABLE" }));
	});

	it("accepts a valid workflow with no validation errors", () => {
		const result = validateWorkflowContent(valid("All Good"));
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("detects PHASE_INITIAL_STATE_INVALID when initialState is missing from states", () => {
		const result = validateWorkflowContent({
			name: "Phases",
			initialStageId: "start",
			stages: [
				{
					id: "start",
					transitions: [{ target: "done" }],
					phases: {
						initialState: "nonexistent",
						states: { open: { transitions: [] }, closed: { transitions: [] } },
					},
				},
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "PHASE_INITIAL_STATE_INVALID" }));
	});

	it("detects PHASE_TRANSITION_TARGET_NOT_FOUND when phase transition points to unknown state", () => {
		const result = validateWorkflowContent({
			name: "PhaseTransition",
			initialStageId: "start",
			stages: [
				{
					id: "start",
					transitions: [{ target: "done" }],
					phases: {
						initialState: "open",
						states: {
							open: { transitions: [{ target: "ghost" }] },
							closed: { transitions: [] },
						},
					},
				},
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "PHASE_TRANSITION_TARGET_NOT_FOUND" }));
	});

	it("accepts a valid phase configuration without errors", () => {
		const result = validateWorkflowContent({
			name: "PhasesOk",
			initialStageId: "start",
			stages: [
				{
					id: "start",
					transitions: [{ target: "done" }],
					phases: {
						initialState: "open",
						states: {
							open: { transitions: [{ target: "closed" }] },
							closed: { transitions: [] },
						},
					},
				},
				{ id: "done", final: true },
			],
		});
		expect(result.errors.filter((e) => e.code.startsWith("PHASE_"))).toHaveLength(0);
	});

	it("detects HUMAN_GATE_DECISIONS_REQUIRED when human gate has no decisions", () => {
		const result = validateWorkflowContent({
			name: "HumanGate",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "done" }], gate: { id: "gate-1", type: "human", decisions: {} } },
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "HUMAN_GATE_DECISIONS_REQUIRED" }));
	});

	it("detects GATE_TYPE_INVALID when gate type is unknown", () => {
		const result = validateWorkflowContent({
			name: "BadGate",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "done" }], gate: { id: "gate-1", type: "magic" } },
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "GATE_TYPE_INVALID" }));
	});

	it("detects GATE_NOT_FOUND when a string gate ref is absent from harness", () => {
		const result = validateWorkflowContent(
			{
				name: "GateRef",
				initialStageId: "start",
				stages: [
					{ id: "start", transitions: [{ target: "done" }], gate: "gates/approve.yaml" },
					{ id: "done", final: true },
				],
			},
			{ harness: { gates: { "other-gate": true } } },
		);
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "GATE_NOT_FOUND" }));
	});

	it("accepts a valid string gate ref when present in harness", () => {
		const result = validateWorkflowContent(
			{
				name: "GateRefOk",
				initialStageId: "start",
				stages: [
					{ id: "start", transitions: [{ target: "done" }], gate: "gates/approve.yaml" },
					{ id: "done", final: true },
				],
			},
			{ harness: { gates: { approve: true } } },
		);
		expect(result.errors.some((e) => e.code === "GATE_NOT_FOUND")).toBe(false);
	});

	it("detects EXECUTOR_ID_INVALID when preferredExecutor is empty string", () => {
		const result = validateWorkflowContent({
			name: "Executor",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "done" }], preferredExecutor: "   " },
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "EXECUTOR_ID_INVALID" }));
	});

	it("detects ROLE_NOT_FOUND when an allow role is absent from harness roles", () => {
		const result = validateWorkflowContent(
			{
				name: "Roles",
				initialStageId: "start",
				stages: [
					{ id: "start", transitions: [{ target: "done" }], allow: ["developer", "ghost-role"] },
					{ id: "done", final: true },
				],
			},
			{ harness: { roles: { developer: true } } },
		);
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "ROLE_NOT_FOUND" }));
	});

	it("detects ALLOW_LIST_INVALID when allow is not an array", () => {
		const result = validateWorkflowContent({
			name: "Allow",
			initialStageId: "start",
			stages: [
				{ id: "start", transitions: [{ target: "done" }], allow: "developer" as any },
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "ALLOW_LIST_INVALID" }));
	});

	it("detects HOOK_ACTION_REQUIRED when hook has no action", () => {
		const result = validateWorkflowContent({
			name: "Hooks",
			initialStageId: "start",
			stages: [
				{
					id: "start",
					transitions: [{ target: "done" }],
					hooks: { on_enter: [{ action: "" }] },
				},
				{ id: "done", final: true },
			],
		});
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "HOOK_ACTION_REQUIRED" }));
	});

	it("accepts valid hooks with action names", () => {
		const result = validateWorkflowContent({
			name: "HooksOk",
			initialStageId: "start",
			stages: [
				{
					id: "start",
					transitions: [{ target: "done" }],
					hooks: { on_enter: [{ action: "notify-slack" }], on_exit: [{ action: "run-tests" }] },
				},
				{ id: "done", final: true },
			],
		});
		expect(result.errors.some((e) => e.code === "HOOK_ACTION_REQUIRED")).toBe(false);
	});

	it("detects STAGE_REMOVAL_ORPHANS_ITEMS when removed stage has unpinned active items", () => {
		const result = validateWorkflowContent(
			{
				name: "Removal",
				initialStageId: "start",
				stages: [
					{ id: "start", transitions: [{ target: "done" }] },
					{ id: "done", final: true },
				],
			},
			{
				existingWorkflow: {
					items: [
						{ id: "item-1", stage: "removed-stage", workflowVersionId: null },  // orphaned
						{ id: "item-2", stage: "start", workflowVersionId: null },            // still valid
						{ id: "item-3", stage: "removed-stage", workflowVersionId: "v1" },   // pinned — safe
					],
				},
			},
		);
		expect(result.errors).toContainEqual(expect.objectContaining({ code: "STAGE_REMOVAL_ORPHANS_ITEMS" }));
		const err = result.errors.find((e) => e.code === "STAGE_REMOVAL_ORPHANS_ITEMS")!;
		expect(err.message).toContain("item-1");
		expect(err.message).not.toContain("item-3");
	});

	it("allows stage removal when all affected items are pinned to a version", () => {
		const result = validateWorkflowContent(
			{
				name: "SafeRemoval",
				initialStageId: "start",
				stages: [
					{ id: "start", transitions: [{ target: "done" }] },
					{ id: "done", final: true },
				],
			},
			{
				existingWorkflow: {
					items: [
						{ id: "item-pinned", stage: "removed-stage", workflowVersionId: "v2" },
					],
				},
			},
		);
		expect(result.errors.some((e) => e.code === "STAGE_REMOVAL_ORPHANS_ITEMS")).toBe(false);
	});
});
