import type { ResolvedFlowDefinition, Workflow } from "@letra/types";
import { describe, expect, it } from "vitest";
import {
	flowWarnings,
	itemOperationalState,
	orderedStages,
	pipelineProjection,
	roleCatalog,
	stageIcon,
	stagePresentation,
} from "./active-flow";

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Arbitrary workflow",
		createdAt: "2026-07-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		stages: [
			{ id: "legacy-a", name: "Legacy A", order: 0 },
			{ id: "legacy-b", name: "Legacy B", order: 1 },
		],
		items: [
			{
				id: "ITEM-A",
				description: "Waiting decision",
				stage: "beta-y",
				createdAt: "2026-07-01T00:00:00.000Z",
			},
			{
				id: "ITEM-B",
				description: "Claimed work",
				stage: "alpha-x",
				createdAt: "2026-07-01T00:00:00.000Z",
				claimedBy: "runtime-agent",
			},
		],
		tools: [],
	};
}

function activeFlow(): ResolvedFlowDefinition {
	const operator = {
		id: "operator",
		label: "Flow Operator",
		description: "Operates the active stage",
		allowedStages: ["alpha-x"],
		capabilities: ["artifact:write"],
	};
	return {
		id: "arbitrary",
		source: "workflow-template",
		harnessVersion: "v-test",
		templateVersion: "1.0.0",
		name: "Arbitrary Flow",
		roles: [operator],
		warnings: [
			{
				code: "INSTANCE_STAGE_NOT_IN_TEMPLATE",
				message: "Compatibility extension",
				artifactRef: 'workflow stage "legacy-a"',
			},
		],
		stages: [
			{
				id: "omega-z",
				name: "Archived",
				order: 30,
				zone: "done",
				roleIds: [],
				roles: [],
				agents: [],
				gate: null,
				provenance: "harness",
			},
			{
				id: "beta-y",
				name: "Direction Check",
				order: 20,
				zone: "doing",
				roleIds: [],
				roles: [],
				agents: [],
				gate: {
					id: "direction",
					name: "Direction approval",
					type: "human",
					blocking: true,
					description: "Human direction is required",
				},
				provenance: "harness",
			},
			{
				id: "alpha-x",
				name: "Intent Work",
				order: 10,
				zone: "doing",
				roleIds: ["operator"],
				roles: [operator],
				agents: ["operator"],
				gate: null,
				provenance: "harness",
			},
		],
	};
}

describe("active-flow projections", () => {
	it("uses active-flow order and labels for arbitrary stage IDs", () => {
		const stages = orderedStages(workflow(), activeFlow());
		expect(stages.map((stage) => [stage.id, stage.name])).toEqual([
			["alpha-x", "Intent Work"],
			["beta-y", "Direction Check"],
			["omega-z", "Archived"],
		]);
	});

	it("derives actors, icons and gate state without inspecting stage IDs", () => {
		const [work, gate, done] = orderedStages(workflow(), activeFlow());
		expect(stagePresentation(work).actorLabel).toBe("Flow Operator");
		expect(stageIcon(work)).toBe("cpu");
		expect(stagePresentation(gate)).toEqual(
			expect.objectContaining({
				actorLabel: "Human",
				icon: "user",
				isHumanGate: true,
			}),
		);
		expect(stageIcon(done)).toBe("check");
	});

	it("derives item and pipeline states from canonical facts", () => {
		const wf = workflow();
		const flow = activeFlow();
		expect(itemOperationalState(wf.items[0], wf, flow)).toBe("waiting");
		expect(itemOperationalState(wf.items[1], wf, flow)).toBe("running");
		expect(pipelineProjection(wf, flow).map((stage) => stage.status)).toEqual([
			"running",
			"waiting",
			"idle",
		]);
	});

	it("returns cloned role and warning projections", () => {
		const flow = activeFlow();
		const roles = roleCatalog(flow);
		const warnings = flowWarnings(flow);
		roles[0].capabilities.push("mutated");
		warnings[0].message = "mutated";
		expect(flow.roles[0].capabilities).toEqual(["artifact:write"]);
		expect(flow.warnings[0].message).toBe("Compatibility extension");
	});

	it("keeps legacy workflow fallback neutral", () => {
		const stages = orderedStages(workflow(), null);
		expect(stages.map((stage) => stage.id)).toEqual(["legacy-a", "legacy-b"]);
		expect(stages.every((stage) => stage.gate === null && stage.roles.length === 0)).toBe(true);
		expect(stages.map(stageIcon)).toEqual(["circle", "circle"]);
	});
});
