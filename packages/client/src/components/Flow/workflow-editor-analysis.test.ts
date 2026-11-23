import { describe, expect, it } from "vitest";
import { type GraphStage, stagesFromTemplate } from "./workflow-editor-analysis";

const template: GraphStage[] = [
	{ id: "done", order: 5, zone: "done" },
	{ id: "backlog", order: 0, zone: "todo" },
	{ id: "design", order: 1, zone: "doing" },
	{ id: "code", order: 2, zone: "doing", transitions: [{ target: "review" }] },
	{ id: "review", order: 3, zone: "doing" },
	{ id: "security", order: 4, zone: "doing" },
];

describe("stagesFromTemplate", () => {
	it("makes the template's order-based progression explicit", () => {
		const stages = stagesFromTemplate(template);
		expect(stages.map((stage) => [stage.id, stage.transitions?.map((t) => t.target) ?? []])).toEqual([
			["backlog", ["design"]],
			["design", ["code"]],
			["code", ["review"]],
			["review", ["security"]],
			["security", ["done"]],
			["done", []],
		]);
	});

	it("marks the done zone as the final stage", () => {
		const stages = stagesFromTemplate(template);
		expect(stages.filter((stage) => stage.final).map((stage) => stage.id)).toEqual(["done"]);
	});

	it("keeps transitions the template already declares", () => {
		const stages = stagesFromTemplate([
			{ id: "a", order: 0, transitions: [{ target: "c" }] },
			{ id: "b", order: 1 },
			{ id: "c", order: 2, final: true },
		]);
		expect(stages[0].transitions).toEqual([{ target: "c" }]);
		expect(stages[1].transitions).toEqual([{ target: "c" }]);
	});

	it("authorizes the template roles through allow", () => {
		const stages = stagesFromTemplate([
			{ id: "design", order: 0, roleIds: ["analyst"] },
			{ id: "code", order: 1, roleIds: ["implementer"], allow: ["implementer", "reviewer"] },
			{ id: "done", order: 2, zone: "done" },
		]);
		expect(stages.map((stage) => stage.allow)).toEqual([["analyst"], ["implementer", "reviewer"], undefined]);
	});

	it("does not mutate the template preview", () => {
		stagesFromTemplate(template);
		expect(template.find((stage) => stage.id === "design")).not.toHaveProperty("transitions");
	});
});
