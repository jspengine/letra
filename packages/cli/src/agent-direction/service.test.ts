import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedFlowDefinition } from "@letra/types";
import type { RunEntity } from "@letra/types";
import type { Workflow } from "../commands/flow-init.js";
import { createAgentDirectionSnapshot, resolveAgentDirection, resolveDirection } from "./service.js";
import { createExecutionRun } from "../execution-runs/store.js";
import { readExecutionRuns } from "../execution-runs/store.js";
import { writeFocusFile } from "../adapters/focus-sync.js";
import { saveWorkflow } from "../commands/flow-init.js";
import { createWorkflowDefinition, createWorkflowDraft, updateWorkflowDraft, publishWorkflowDraft } from "../workflow-versions/service.js";

const roots: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-agent-direction-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "adapter-platform-v2"), { recursive: true });
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Test",
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		harnessVersion: "v1",
		template: "main",
		stages: [
			{ id: "design", name: "Design", order: 0 },
			{ id: "build", name: "Build", order: 1 },
			{ id: "review", name: "Review", order: 2 },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Native adapter",
				stage: "build",
				spec: "adapter-platform-v2",
				createdAt: "2026-07-04T00:00:00.000Z",
			},
		],
		tools: ["codex"],
	};
}

function flow(): ResolvedFlowDefinition {
	return {
		id: "main",
		source: "workflow-template",
		harnessVersion: "v1",
		templateVersion: "1",
		name: "Main",
		operations: { complete: { requiredCapability: "write_code", requiresClaim: true, allowedInStages: ["build"], allowedActors: ["implementer"], description: "Complete assigned work." } },
		roles: [
			{
				id: "builder",
				label: "Builder",
				description: "Builds",
				allowedStages: ["build"],
				capabilities: ["edit"],
			},
		],
		warnings: [],
		stages: [
			{
				id: "design",
				name: "Design",
				order: 0,
				roleIds: [],
				roles: [],
				agents: [],
				gate: null,
				provenance: "harness",
			},
			{
				id: "build",
				name: "Build",
				order: 1,
				roleIds: ["builder"],
				roles: [
					{
						id: "builder",
						label: "Builder",
						description: "Builds",
						allowedStages: ["build"],
						capabilities: ["edit"],
					},
				],
				agents: ["builder"],
				gate: { id: "review-gate", name: "Review", type: "human", blocking: true, policyRef: "gates/review.yaml", description: "Human review", checkType: "acceptance-complete" },
				activity: {
					implement: {
						objective: "Implement the active criterion.",
						commands: [
							{ command: "letra ac done <AC-ID> --item <ITEM-ID>", label: "Complete AC" },
							{
								command: "letra flow move <ITEM-ID> --to <NEXT-STAGE>",
								label: "Advance",
							},
						],
						mustNotDo: ["Do not bypass tests."],
						nextActions: [
							{ label: "Implement", description: "Implement with regression tests." },
						],
					},
				},
				provenance: "harness",
			},
			{
				id: "review",
				name: "Review",
				order: 2,
				roleIds: ["reviewer"],
				roles: [],
				agents: ["reviewer"],
				gate: null,
				provenance: "harness",
			},
		],
	};
}

function publishTestWorkflow(root: string, name: string) {
	const identityDir = join(root, ".letra", "identity");
	mkdirSync(identityDir, { recursive: true });
	writeFileSync(join(identityDir, "local.json"), JSON.stringify({ id: "human:test", osUser: "test", hostname: "test-host", createdAt: new Date().toISOString() }));
	const created = createWorkflowDefinition(root, {
		name: "Pinned Flow",
		actor: "human:test",
		content: { name, initialStageId: "design", stages: [{ id: "design", transitions: [{ target: "build" }] }, { id: "build", transitions: [{ target: "review" }] }, { id: "review", final: true }] },
	});
	const version = publishWorkflowDraft(root, created.definition.id, { expectedRevision: 1, actor: "human:test", reason: `Publish ${name}` });
	return { definitionId: created.definition.id, version };
}

describe("AgentDirectionService", () => {
	it("produces a structured snapshot from canonical flow data without inventing fields", () => {
		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: "C:/workspace",
			workflow: workflow(),
			flow: flow(),
			currentItemId: "ITEM-1",
			specContent: [
				"# Spec",
				"- [x] **AC1 — Ready**: complete",
				"- [ ] **AC2 — Next**: implement direction",
			].join("\n"),
			now: "2026-07-04T12:00:00.000Z",
		});

		expect(snapshot).toMatchObject({
			schemaVersion: "1",
			mode: "active",
			item: {
				id: "ITEM-1",
				stage: "build",
				spec: "adapter-platform-v2",
			},
			roleIds: ["builder"],
			allowedStageIds: ["build"],
			objective: "Implement the active criterion.",
			pendingAC: {
				id: "AC2",
				description: "implement direction",
			},
			prohibitions: ["Do not bypass tests."],
			requiredEvidence: [],
			operations: [{ id: "complete", description: "Complete assigned work.", requiredCapability: "write_code", requiresClaim: true, allowedInStages: ["build"], allowedActors: ["implementer"] }],
			gates: [{ id: "review-gate", name: "Review", type: "human", blocking: true, policyRef: "gates/review.yaml", checkType: "acceptance-complete" }],
		});
		expect(snapshot.commands.map((command) => command.command)).toEqual([
			"letra ac done AC2 --item ITEM-1",
			"letra flow move ITEM-1 --to review",
		]);
		expect(snapshot.nextActions).toEqual([
			{
				id: "implement",
				label: "Implement",
				reason: "Implement with regression tests.",
			},
		]);
	});

	it("keeps revision stable for the same semantics and changes it when the pending AC changes", () => {
		const input = {
			workspaceRoot: "C:/workspace",
			workflow: workflow(),
			flow: flow(),
			specContent: "- [ ] **AC2 — Next**: implement direction",
		};
		const first = createAgentDirectionSnapshot({
			...input,
			now: "2026-07-04T12:00:00.000Z",
		});
		const later = createAgentDirectionSnapshot({
			...input,
			now: "2026-07-04T13:00:00.000Z",
		});
		const changed = createAgentDirectionSnapshot({
			...input,
			specContent:
				"- [x] **AC2 — Next**: implement direction\n- [ ] **AC3 — Service**: extract",
			now: "2026-07-04T13:00:00.000Z",
		});

		expect(first.revision).toBe(later.revision);
		expect(first.generatedAt).not.toBe(later.generatedAt);
		expect(changed.revision).not.toBe(first.revision);
	});

	it("returns unconfigured without workflow and degraded when the flow has authority warnings", () => {
		const unconfigured = createAgentDirectionSnapshot({
			workspaceRoot: "C:/workspace",
			workflow: null,
			flow: null,
			specContent: null,
		});
		const degradedFlow = flow();
		degradedFlow.warnings = [
			{
				code: "HARNESS_UNAVAILABLE",
				message: "Harness unavailable.",
			},
		];
		const degraded = createAgentDirectionSnapshot({
			workspaceRoot: "C:/workspace",
			workflow: workflow(),
			flow: degradedFlow,
			specContent: null,
		});

		expect(unconfigured.mode).toBe("unconfigured");
		expect(unconfigured.item).toBeNull();
		expect(degraded.mode).toBe("degraded");
		expect(degraded.warnings).toContainEqual({
			code: "HARNESS_UNAVAILABLE",
			message: "Harness unavailable.",
		});
		expect(degraded.warnings).toContainEqual({
			code: "CONSTITUTION_MISSING",
			message: "Constitution file not found in workspace",
		});
	});

	it("sanitizes shadow state when the workspace link is invalid", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra-link"), "missing-canonical-workspace\n", "utf8");
		writeFileSync(
			join(root, ".letra", "workflow.json"),
			JSON.stringify({
				version: "shadow",
				primaryItemId: "SHADOW-1",
				items: [{ id: "SHADOW-1", description: "shadow item", stage: "code", spec: "shadow-spec" }],
				stages: [{ id: "code", name: "Code", order: 0 }],
			}),
		);
		writeFileSync(join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"), "- [ ] **AC99**: shadow criterion\n");

		const snapshot = resolveAgentDirection(root, "ITEM-1");

		expect(snapshot).toMatchObject({
			mode: "degraded",
			item: null,
			roleIds: [],
			allowedStageIds: [],
			objective: null,
			pendingAC: null,
			commands: [],
			prohibitions: [],
			requiredEvidence: [],
			nextActions: [],
			workspace: {
				code: "WORKSPACE_LINK_INVALID",
				recovery: expect.stringContaining("letra sync --mirror link-to-workspace"),
			},
		});
		expect(snapshot.warnings).toEqual([
			expect.objectContaining({ code: "WORKSPACE_LINK_INVALID" }),
		]);
	});

	it("resolves the current workspace through the canonical flow resolver", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(currentWorkflow));
		writeFileSync(
			join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"),
			"# Spec\n\n## Acceptance Criteria\n- [ ] **AC3 — Direction**: implement service\n",
		);

		const snapshot = resolveAgentDirection(root, "ITEM-1");

		expect(snapshot.item?.id).toBe("ITEM-1");
		expect(snapshot.pendingAC?.id).toBe("AC3");
		expect(snapshot.mode).toBe("degraded");
		expect(snapshot.warnings.some((warning) => warning.code === "HARNESS_UNAVAILABLE")).toBe(
			true,
		);
	});

	it("selects direction by runId and never falls back when that run is missing", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		currentWorkflow.items.push({
			id: "ITEM-2",
			description: "Second task",
			stage: "build",
			spec: "second-spec",
			createdAt: "2026-07-04T00:00:00.000Z",
		});
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(currentWorkflow));
		writeFileSync(join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"), "- [ ] **AC2**: build run context\n");
		mkdirSync(join(root, ".letra", "specs", "second-spec"), { recursive: true });
		writeFileSync(join(root, ".letra", "specs", "second-spec", "spec.md"), "- [ ] **AC9**: second run context\n");
		const { version } = publishTestWorkflow(root, "Run Flow");
		const run: RunEntity = {
			id: "RUN-2", workspaceId: root, itemId: "ITEM-2",
			binding: { actorId: "agent-a:builder:executor-a", identityId: "agent-a", roleId: "builder", executorId: "executor-a" },
			authorization: { kind: "claim", actorId: "agent-a", referenceId: "claim-2", grantedAt: "2026-07-04T00:00:00.000Z", revision: "rev-2" },
			workflowVersionId: version.id, cycle: { number: 1, startedAt: "2026-07-04T00:00:00.000Z", endedAt: null },
			lease: null, revision: 1, directionRevision: "direction-1", createdAt: "2026-07-04T00:00:00.000Z", updatedAt: "2026-07-04T00:00:00.000Z",
			result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running",
		};
		createExecutionRun(root, run);

		const snapshot = resolveAgentDirection(root, "ITEM-1", { runId: "RUN-2" });
		expect(snapshot.item?.id).toBe("ITEM-2");
		expect(snapshot.run).toMatchObject({ id: "RUN-2", itemId: "ITEM-2", executorId: "executor-a" });
		expect(snapshot.pendingAC?.id).toBe("AC9");
		writeFocusFile(root, "adapter-platform-v2", "ITEM-1");
		const afterAttentionChange = resolveAgentDirection(root, undefined, { runId: "RUN-2" });
		expect(afterAttentionChange.revision).toBe(snapshot.revision);
		expect(afterAttentionChange.item?.id).toBe("ITEM-2");
		expect(readExecutionRuns(root).runs[0]?.authorization).toEqual(run.authorization);
		expect(() => resolveAgentDirection(root, undefined, { runId: "RUN-MISSING" })).toThrow("RUN_NOT_FOUND");
		expect(() => resolveDirection(root, { runId: "RUN-MISSING" })).toThrow("RUN_NOT_FOUND");
		expect(() => resolveDirection(root, { runId: "RUN-2", executorId: "other-executor" })).toThrow("RUN_UNAUTHORIZED");
		const expiredRun = { ...run, id: "RUN-EXPIRED", lease: { expiresAt: "2026-07-04T00:00:00.000Z", heartbeatAt: "2026-07-04T00:00:00.000Z", ttlMinutes: 30 } };
		createExecutionRun(root, expiredRun);
		expect(() => resolveDirection(root, { runId: "RUN-EXPIRED" })).toThrow("RUN_INACTIVE");
	});

	it("does not use focus or primaryItemId as execution direction without a Run", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		currentWorkflow.primaryItemId = "ITEM-1";
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(currentWorkflow));
		writeFocusFile(root, "adapter-platform-v2", "ITEM-1");

		const legacy = resolveAgentDirection(root);
		const direction = resolveDirection(root);
		expect(legacy.item).toBeNull();
		expect(legacy.references.some((reference) => reference.path.includes("adapter-platform-v2"))).toBe(false);
		expect(direction.item).toBeNull();
		expect(direction.assignment).toEqual({ status: "unassigned" });
	});

	it("reconstructs the same Run direction after restart from durable state only", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		currentWorkflow.primaryItemId = "ITEM-1";
		saveWorkflow(root, currentWorkflow);
		const { version } = publishTestWorkflow(root, "Reconstruct Flow");
		const now = "2026-07-04T00:00:00.000Z";
		createExecutionRun(root, {
			id: "RUN-RECONSTRUCT", workspaceId: root, itemId: "ITEM-1",
			binding: { actorId: "agent-a:builder:executor-a", identityId: "agent-a", roleId: "builder", executorId: "executor-a" },
			authorization: { kind: "claim", actorId: "agent-a", referenceId: "claim-reconstruct", grantedAt: now, revision: "claim-rev" },
			workflowVersionId: version.id, cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1,
			directionRevision: "run-direction-rev", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running",
		});
		writeFileSync(join(root, ".letra", "context.md"), "# Context\n\n<!-- sitrep:start -->\nITEM-OLD\n<!-- sitrep:end -->\n");
		const before = resolveDirection(root, { runId: "RUN-RECONSTRUCT" });

		// Simulate a fresh resolver process with contradictory, non-canonical projections.
		writeFocusFile(root, "different-spec", "ITEM-OTHER");
		writeFileSync(join(root, ".letra", "context.md"), "# Context\n\n<!-- sitrep:start -->\nITEM-OTHER\n<!-- sitrep:end -->\n");
		const reconstructed = resolveDirection(root, { runId: "RUN-RECONSTRUCT" });

		expect(reconstructed.item?.id).toBe("ITEM-1");
		expect(reconstructed.run?.workflowVersionId).toBe(version.id);
		expect(reconstructed.revision).toBe(before.revision);
		expect(reconstructed.assignment).toEqual({ status: "assigned", runId: "RUN-RECONSTRUCT" });
	});

	it("keeps an execution pinned to its published workflow version after a newer publication", () => {
		const root = tempRoot();
		const localWorkflow = workflow();
		saveWorkflow(root, localWorkflow);
		const { definitionId, version: firstVersion } = publishTestWorkflow(root, "Version One");
		const now = "2026-07-04T00:00:00.000Z";
		const makeRun = (id: string, workflowVersionId: string): RunEntity => ({
			id, workspaceId: root, itemId: "ITEM-1",
			binding: { actorId: "agent-a:builder:executor-a", identityId: "agent-a", roleId: "builder", executorId: "executor-a" },
			authorization: { kind: "claim", actorId: "agent-a", referenceId: `claim-${id}`, grantedAt: now, revision: "rev-1" },
			workflowVersionId, cycle: { number: 1, startedAt: now, endedAt: null }, lease: null, revision: 1,
			directionRevision: "direction-1", createdAt: now, updatedAt: now, result: null, handoffs: [], gateDecisions: [], evidence: [], status: "running",
		});
		createExecutionRun(root, makeRun("RUN-V1", firstVersion.id));
		const pinnedBefore = resolveAgentDirection(root, undefined, { runId: "RUN-V1" });
		const draft = createWorkflowDraft(root, definitionId, "human:test");
		updateWorkflowDraft(root, definitionId, { expectedRevision: draft.revision, actor: "human:test", content: { name: "Version Two", initialStageId: "design", stages: [{ id: "design", transitions: [{ target: "build" }] }, { id: "build", transitions: [{ target: "review" }] }, { id: "review", final: true }] } });
		const secondVersion = publishWorkflowDraft(root, definitionId, { expectedRevision: draft.revision + 1, actor: "human:test", reason: "Publish V2" });
		const pinnedAfter = resolveAgentDirection(root, undefined, { runId: "RUN-V1" });
		createExecutionRun(root, makeRun("RUN-V2", secondVersion.id));
		const newRun = resolveAgentDirection(root, undefined, { runId: "RUN-V2" });
		createExecutionRun(root, makeRun("RUN-UNKNOWN", "missing-workflow-version"));

		expect(pinnedBefore.source.workflowVersionId).toBe(firstVersion.id);
		expect(pinnedAfter.source.workflowVersionId).toBe(firstVersion.id);
		expect(pinnedAfter.revision).toBe(pinnedBefore.revision);
		expect(newRun.source.workflowVersionId).toBe(secondVersion.id);
		expect(newRun.revision).not.toBe(pinnedAfter.revision);
		expect(() => resolveAgentDirection(root, undefined, { runId: "RUN-UNKNOWN" })).toThrow("WORKFLOW_VERSION_NOT_FOUND");
	});

	it("keeps review-created criteria in the direction loop when acceptance.md is stale", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(currentWorkflow));
		writeFileSync(
			join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"),
			"# Spec\n\n## Acceptance Criteria\n- [x] **AC1**: initial work\n\n## Retorno de revisão\n\n- [ ] **AC62 — Correção de revisão**: recriar executor para a localização selecionada\n- [ ] AC63: liberar claim falho imediatamente\n",
		);
		writeFileSync(
			join(root, ".letra", "specs", "adapter-platform-v2", "acceptance.md"),
			"# Acceptance Criteria\n\n- [x] **AC1**: initial work\n",
		);

		const snapshot = resolveAgentDirection(root, "ITEM-1");
		expect(snapshot.pendingAC).toEqual({
			id: "AC62",
			description: "recriar executor para a localização selecionada",
		});
	});

	it("prefers canonical workspace specs over a stale nested .letra projection", () => {
		const root = tempRoot();
		mkdirSync(root, { recursive: true });
		writeFileSync(join(root, "workflow.json"), JSON.stringify(workflow()));
		const canonical = join(root, "specs", "adapter-platform-v2");
		mkdirSync(canonical, { recursive: true });
		writeFileSync(join(canonical, "spec.md"), "# Canonical\n- [x] **AC1 — Complete**: done\n- [ ] **AC10 — Next**: migrate safely\n");
		mkdirSync(join(root, ".letra", "specs", "adapter-platform-v2"), { recursive: true });
		writeFileSync(join(root, ".letra", "specs", "adapter-platform-v2", "acceptance.md"), "# Legacy\n- [ ] **AC1 — Stale**: stale copy\n");
		const snapshot = resolveAgentDirection(root, "ITEM-1");
		expect(snapshot.pendingAC).toMatchObject({ id: "AC10", description: "migrate safely" });
	});

	it("includes gap criteria that exist only in acceptance.md", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));
		writeFileSync(join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"), "# Spec\n- [x] **AC1**: initial work\n");
		writeFileSync(join(root, ".letra", "specs", "adapter-platform-v2", "acceptance.md"), "# Acceptance\n- [ ] **AC-gap-2.1**: local identity registry\n");

		expect(resolveAgentDirection(root, "ITEM-1").pendingAC).toEqual({ id: "AC-gap-2.1", description: "local identity registry" });
	});
});

describe("Constitution Governance", () => {
	it("includes governanceReferences with constitution when available", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));
		writeFileSync(
			join(root, ".letra", "constitution.md"),
			"# Constitution\n\n**Version:** 1.3.0\n\n## Principles\n",
		);

		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			now: "2026-08-23T12:00:00.000Z",
		});

		expect(snapshot.governanceReferences).toBeDefined();
		expect(snapshot.governanceReferences).toHaveLength(1);
		expect(snapshot.governanceReferences?.[0]).toMatchObject({
			path: "constitution.md",
			version: "1.3.0",
			available: true,
			source: "workspace",
		});
		expect(snapshot.constitutionVersion).toBe("1.3.0");
	});

	it("includes governanceReferences with unavailable constitution when missing", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));

		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			now: "2026-08-23T12:00:00.000Z",
		});

		expect(snapshot.governanceReferences).toBeDefined();
		expect(snapshot.governanceReferences).toHaveLength(1);
		expect(snapshot.governanceReferences?.[0]).toMatchObject({
			path: "constitution.md",
			version: "unknown",
			available: false,
			source: "workspace",
		});
		expect(snapshot.warnings).toContainEqual({
			code: "CONSTITUTION_MISSING",
			message: "Constitution file not found in workspace",
		});
	});

	it("reads constitution version from file", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));
		writeFileSync(
			join(root, ".letra", "constitution.md"),
			"# Constitution\n\n**Version:** 2.0.0\n**Date:** 2026-08-23\n",
		);

		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			now: "2026-08-23T12:00:00.000Z",
		});

		expect(snapshot.constitutionVersion).toBe("2.0.0");
		expect(snapshot.governanceReferences?.[0].version).toBe("2.0.0");
	});

	it("uses provided constitutionVersion when specified", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));
		writeFileSync(
			join(root, ".letra", "constitution.md"),
			"# Constitution\n\n**Version:** 1.3.0\n",
		);

		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			constitutionVersion: "1.5.0",
			now: "2026-08-23T12:00:00.000Z",
		});

		expect(snapshot.constitutionVersion).toBe("1.5.0");
	});

	it("changes revision when constitution availability changes", () => {
		const root = tempRoot();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow()));
		writeFileSync(
			join(root, ".letra", "constitution.md"),
			"# Constitution\n\n**Version:** 1.3.0\n",
		);

		const withConstitution = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			now: "2026-08-23T12:00:00.000Z",
		});

		// Remove constitution
		rmSync(join(root, ".letra", "constitution.md"));

		const withoutConstitution = createAgentDirectionSnapshot({
			workspaceRoot: root,
			workflow: workflow(),
			flow: flow(),
			specContent: null,
			now: "2026-08-23T12:00:00.000Z",
		});

		expect(withConstitution.revision).not.toBe(withoutConstitution.revision);
		expect(withoutConstitution.warnings).toContainEqual(
			expect.objectContaining({ code: "CONSTITUTION_MISSING" }),
		);
	});
});
