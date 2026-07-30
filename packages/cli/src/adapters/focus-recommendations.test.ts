import { describe, expect, it } from "vitest";
import type { Workflow } from "../commands/flow-init.js";
import type { ResolvedFlowDefinition } from "../flow-definition/types.js";
import { collectFocusRecommendations } from "./focus-recommendations.js";

describe("collectFocusRecommendations", () => {
	it("uses commands from the active harness stage and resolves item placeholders", () => {
		const workflow = {
			stages: [
				{ id: "code", name: "Code", order: 1, zone: "doing" },
				{ id: "review", name: "Review", order: 2, zone: "doing" },
			],
			items: [{ id: "ITEM-9", description: "Test", stage: "code", createdAt: "" }],
		} as Workflow;
		const flow = {
			stages: [
				{
					id: "code",
					order: 1,
					activity: {
						implement: {
							commands: [
								{
									label: "Concluir AC",
									description: "Registrar progresso.",
									command: "letra ac done <AC-ID>",
								},
								{
									label: "Avançar",
									description: "Mover após validação.",
									command: "letra flow move <ITEM-ID> --to <NEXT-STAGE>",
								},
							],
						},
					},
				},
				{ id: "review", order: 2 },
			],
		} as unknown as ResolvedFlowDefinition;

		expect(collectFocusRecommendations(workflow, flow, "ITEM-9")).toEqual([
			{
				label: "Concluir AC",
				description: "Registrar progresso.",
				command: "letra ac done <AC-ID>",
			},
			{
				label: "Avançar",
				description: "Mover após validação.",
				command: "letra flow move ITEM-9 --to review",
			},
		]);
	});

	it("returns no recommendations when the harness declares no commands", () => {
		const workflow = {
			stages: [{ id: "code", name: "Code", order: 1 }],
			items: [{ id: "ITEM-9", description: "Test", stage: "code", createdAt: "" }],
		} as Workflow;
		const flow = {
			stages: [{ id: "code", order: 1, activity: { implement: { commands: [] } } }],
		} as unknown as ResolvedFlowDefinition;

		expect(collectFocusRecommendations(workflow, flow, "ITEM-9")).toEqual([]);
	});
});
