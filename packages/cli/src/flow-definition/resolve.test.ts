import { describe, expect, it } from "vitest";
import type { Workflow } from "../commands/flow-init.js";
import type { HarnessManifest } from "../harness/types.js";
import { resolveActiveFlowFrom } from "./resolve.js";

function makeWorkflow(overrides?: Partial<Workflow>): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-06-27T00:00:00.000Z",
		updatedAt: "2026-06-27T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "design", name: "Design", order: 1, zone: "doing" },
			{ id: "done", name: "Done", order: 2, zone: "done" },
		],
		items: [],
		tools: [],
		...overrides,
	};
}

function makeHarness(): HarnessManifest {
	return {
		version: "0.1.0",
		flows: {
			sdlc: {
				id: "sdlc",
				version: "1.0.0",
				name: "SDLC",
				description: "",
				defaultPolicy: "default",
				stages: [
					{
						id: "backlog",
						name: "Backlog",
						order: 0,
						zone: "todo",
						description: "",
						agents: ["analyst"],
						gate: null,
					},
					{
						id: "design",
						name: "Design",
						order: 1,
						zone: "doing",
						description: "Design stage",
						agents: ["analyst"],
						gate: "gates/spec-review.yaml",
						activity: {
							design: {
								objective: "Define the solution from harness metadata",
								nextActions: [
									{ label: "Draft", description: "Prepare the design" },
								],
							},
							gate: {
								label: "Aprovação de direção/spec",
								evidence: "outcome, constraints, exclusions e decisões em aberto",
								signalCode: "spec-approval",
							},
						},
						phases: {
							initialState: "draft",
							states: {
								draft: {
									id: "draft",
									label: "Draft",
									description: "Draft design",
									transitions: [{ target: "approved", gate: "spec-review" }],
								},
								approved: {
									id: "approved",
									label: "Approved",
									description: "Approved design",
								},
							},
						},
					},
					{
						id: "done",
						name: "Done",
						order: 2,
						zone: "done",
						description: "",
						agents: [],
						gate: null,
					},
				],
			},
		},
		gates: {
			"spec-review": {
				id: "spec-review",
				name: "Spec Review",
				type: "human",
				blocking: true,
				description: "Needs human approval",
			},
		},
		roles: {},
		policies: {},
	};
}

describe("resolveActiveFlowFrom", () => {
	it("resolves flow from workflow template and harness", () => {
		const workflow = makeWorkflow({ template: "sdlc" });
		workflow.stages[1] = {
			...workflow.stages[1],
			name: "Legacy Design",
			order: 99,
			zone: "todo",
		};
		const result = resolveActiveFlowFrom(workflow, makeHarness());
		expect(result.flow?.source).toBe("workflow-template");
		expect(result.flow?.id).toBe("sdlc");
		expect(result.flow?.stages[1].name).toBe("Design");
		expect(result.flow?.stages[1].order).toBe(1);
		expect(result.flow?.stages[1].zone).toBe("doing");
		expect(result.flow?.stages[1].gate?.id).toBe("spec-review");
		expect(result.flow?.stages[1].agents).toEqual(["analyst"]);
		expect(result.flow?.stages[1].roleIds).toEqual(["analyst"]);
		expect(result.flow?.stages[1].phases?.initialState).toBe("draft");
		expect(result.flow?.stages[1].phases?.states.draft.transitions?.[0].gate?.id).toBe(
			"spec-review",
		);
		expect(result.flow?.stages[1].activity?.gate?.signalCode).toBe("spec-approval");
		expect(result.flow?.stages[1].activity?.design?.objective).toBe(
			"Define the solution from harness metadata",
		);
	});

	it("falls back to workflow instance when no template exists", () => {
		const result = resolveActiveFlowFrom(makeWorkflow(), makeHarness());
		expect(result.flow?.source).toBe("workflow-instance");
		expect(result.flow?.stages[1].gate).toBeNull();
	});

	it("falls back to legacy mode when template is declared but missing in harness", () => {
		const result = resolveActiveFlowFrom(
			makeWorkflow({ template: "custom-flow" }),
			makeHarness(),
		);
		expect(result.flow?.source).toBe("legacy-fallback");
		expect(result.flow?.id).toBe("custom-flow");
		expect(result.flow?.warnings).toEqual([
			expect.objectContaining({ code: "TEMPLATE_NOT_FOUND" }),
		]);
	});

	it("returns null flow when workflow is absent", () => {
		const result = resolveActiveFlowFrom(null, makeHarness());
		expect(result.flow).toBeNull();
	});

	it("normalizes role labels and capabilities", () => {
		const harness = makeHarness();
		harness.roles.analyst = {
			id: "analyst",
			label: "Analista",
			description: "Refines intent",
			allowedStages: ["design"],
			capabilities: ["spec:write"],
		};

		const result = resolveActiveFlowFrom(makeWorkflow({ template: "sdlc" }), harness);
		expect(result.flow?.roles[0]).toEqual({
			id: "analyst",
			label: "Analista",
			description: "Refines intent",
			allowedStages: ["design"],
			capabilities: ["spec:write"],
		});
		expect(result.flow?.stages[1].roles[0]?.label).toBe("Analista");
		expect(result.flow?.warnings).toEqual([]);
	});

	it("keeps template and instance stage drift visible with stable warnings", () => {
		const workflow = makeWorkflow({
			template: "sdlc",
			stages: [
				{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
				{ id: "custom", name: "Custom", order: 5, zone: "doing" },
			],
		});
		const harness = makeHarness();
		harness.roles.analyst = {
			id: "analyst",
			label: "Analyst",
			description: "",
			allowedStages: ["backlog", "design"],
			capabilities: [],
		};
		const result = resolveActiveFlowFrom(workflow, harness);

		expect(result.flow?.stages.map((stage) => stage.id)).toEqual([
			"backlog",
			"design",
			"done",
			"custom",
		]);
		expect(result.flow?.stages.find((stage) => stage.id === "custom")?.provenance).toBe(
			"workflow-instance",
		);
		expect(result.flow?.warnings.map((warning) => warning.code)).toEqual([
			"TEMPLATE_STAGE_NOT_IN_INSTANCE",
			"TEMPLATE_STAGE_NOT_IN_INSTANCE",
			"INSTANCE_STAGE_NOT_IN_TEMPLATE",
		]);
	});

	it("reports unresolved role and phase gate references", () => {
		const harness = makeHarness();
		const transitions = harness.flows.sdlc.stages[1].phases?.states.draft.transitions;
		expect(transitions).toBeDefined();
		if (!transitions) throw new Error("Expected draft transitions in test harness");
		transitions[0].gate = "missing-gate";
		const result = resolveActiveFlowFrom(makeWorkflow({ template: "sdlc" }), harness);

		expect(result.flow?.warnings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "ROLE_NOT_FOUND" }),
				expect.objectContaining({
					code: "GATE_NOT_FOUND",
					artifactRef: expect.stringContaining("phase"),
				}),
			]),
		);
		expect(result.flow?.stages[1].phases?.states.draft.transitions?.[0]).toEqual(
			expect.objectContaining({ gate: null, gateRef: "missing-gate" }),
		);
	});

	it("does not share mutable nested data with workflow or harness inputs", () => {
		const workflow = makeWorkflow({ template: "sdlc" });
		const harness = makeHarness();
		harness.roles.analyst = {
			id: "analyst",
			label: "Analista",
			description: "Refines intent",
			allowedStages: ["design"],
			capabilities: ["spec:write"],
		};
		const result = resolveActiveFlowFrom(workflow, harness);
		const flow = result.flow;
		expect(flow).not.toBeNull();
		if (!flow) throw new Error("Expected a resolved flow");

		flow.stages.reverse();
		flow.roles[0].capabilities.push("mutated");
		flow.stages.find((stage) => stage.id === "design")?.roleIds.push("mutated");

		expect(workflow.stages.map((stage) => stage.id)).toEqual(["backlog", "design", "done"]);
		expect(harness.roles.analyst.capabilities).toEqual(["spec:write"]);
		expect(harness.flows.sdlc.stages[1].agents).toEqual(["analyst"]);
	});
});
