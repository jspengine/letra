import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedFlowDefinition } from "@letra/types";
import type { Workflow } from "../commands/flow-init.js";
import {
	createAgentDirectionSnapshot,
	resolveAgentDirection,
} from "./service.js";

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
		items: [{
			id: "ITEM-1",
			description: "Native adapter",
			stage: "build",
			spec: "adapter-platform-v2",
			createdAt: "2026-07-04T00:00:00.000Z",
		}],
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
		roles: [{
			id: "builder",
			label: "Builder",
			description: "Builds",
			allowedStages: ["build"],
			capabilities: ["edit"],
		}],
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
				roles: [{
					id: "builder",
					label: "Builder",
					description: "Builds",
					allowedStages: ["build"],
					capabilities: ["edit"],
				}],
				agents: ["builder"],
				gate: null,
				activity: {
					implement: {
						objective: "Implement the active criterion.",
						commands: [
							{ command: "letra ac done <AC-ID>", label: "Complete AC" },
							{ command: "letra flow move <ITEM-ID> --to <NEXT-STAGE>", label: "Advance" },
						],
						mustNotDo: ["Do not bypass tests."],
						nextActions: [{ label: "Implement", description: "Implement with regression tests." }],
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
		expect(snapshot.nextActions).toEqual([{
			id: "implement",
			label: "Implement",
			reason: "Implement with regression tests.",
		}]);
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
			specContent: "- [x] **AC2 — Next**: implement direction\n- [ ] **AC3 — Service**: extract",
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
		degradedFlow.warnings = [{
			code: "HARNESS_UNAVAILABLE",
			message: "Harness unavailable.",
		}];
		const degraded = createAgentDirectionSnapshot({
			workspaceRoot: "C:/workspace",
			workflow: workflow(),
			flow: degradedFlow,
			specContent: null,
		});

		expect(unconfigured.mode).toBe("unconfigured");
		expect(unconfigured.item).toBeNull();
		expect(degraded.mode).toBe("degraded");
		expect(degraded.warnings).toEqual([{
			code: "HARNESS_UNAVAILABLE",
			message: "Harness unavailable.",
		}]);
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
		expect(snapshot.warnings.some((warning) => warning.code === "HARNESS_UNAVAILABLE")).toBe(true);
	});
});
