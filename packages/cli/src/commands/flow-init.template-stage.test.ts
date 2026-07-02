import { describe, expect, it } from "vitest";
import { stageFromTemplateStage } from "./flow-init.js";
import type { StageDef } from "../harness/types.js";

describe("stageFromTemplateStage", () => {
	it("materializes phases from harness template into workflow stage", () => {
		const templateStage: StageDef = {
			id: "code-review",
			name: "Code Review",
			order: 4,
			zone: "doing",
			description: "Review stage",
			agents: ["reviewer"],
			gate: "gates/human-approved-code.yaml",
			phases: {
				initialState: "auto-review",
				states: {
					"auto-review": {
						id: "auto-review",
						label: "Auto Review",
						description: "Agent reviews diff",
						transitions: [{ target: "human-review" }],
						actions: [{ type: "agent-prompt", prompt: "Review diff" }],
						harness: {
							instructions: "Focus on bugs",
							checks: ["tests passing"],
						},
					},
				},
			},
		};

		const stage = stageFromTemplateStage(templateStage);

		expect(stage.id).toBe("code-review");
		expect(stage.phases?.initialState).toBe("auto-review");
		expect(stage.phases?.states["auto-review"].harness?.checks).toEqual(["tests passing"]);
		expect(stage.phases).not.toBe(templateStage.phases);
	});
});
