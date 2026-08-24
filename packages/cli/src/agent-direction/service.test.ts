import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedFlowDefinition } from "@letra/types";
import type { Workflow } from "../commands/flow-init.js";
import { createAgentDirectionSnapshot, resolveAgentDirection } from "./service.js";

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
				gate: null,
				activity: {
					implement: {
						objective: "Implement the active criterion.",
						commands: [
							{ command: "letra ac done <AC-ID>", label: "Complete AC" },
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

describe("AgentDirectionService", () => {
	it("produces a structured snapshot from canonical flow data without inventing fields", () => {
		const snapshot = createAgentDirectionSnapshot({
			workspaceRoot: "C:/workspace",
			workflow: workflow(),
			flow: flow(),
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
		});
		expect(snapshot.commands.map((command) => command.command)).toEqual([
			"letra ac done AC2",
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

	it("resolves the current workspace through the canonical flow resolver", () => {
		const root = tempRoot();
		const currentWorkflow = workflow();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(currentWorkflow));
		writeFileSync(
			join(root, ".letra", "specs", "adapter-platform-v2", "spec.md"),
			"# Spec\n\n## Acceptance Criteria\n- [ ] **AC3 — Direction**: implement service\n",
		);

		const snapshot = resolveAgentDirection(root);

		expect(snapshot.item?.id).toBe("ITEM-1");
		expect(snapshot.pendingAC?.id).toBe("AC3");
		expect(snapshot.mode).toBe("degraded");
		expect(snapshot.warnings.some((warning) => warning.code === "HARNESS_UNAVAILABLE")).toBe(
			true,
		);
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
