import { describe, expect, it } from "vitest";
import { projectKanbanCard } from "./kanban-card-projection";
describe("KanbanCardProjection", () => {
	it("resolves identity and hides raw claim aliases", () => {
		const item = { id: "I", description: "Work", stage: "code", createdAt: "" } as any;
		const workflow = { stages: [{ id: "code", name: "Code", order: 1 }], items: [item] } as any;
		const agent = { id: "turing", displayName: "Alan Turing", role: "implementer", avatar: { type: "initials", value: "AT" }, color: "blue", skills: [], status: "online", stageBindings: [] } as any;
		const result = projectKanbanCard({ ...item, claimedBy: "builder" }, workflow, null, [], [agent]);
		expect(result.identity?.displayName).toBe("Alan Turing"); expect(result.persona).toBe("implementer"); expect(result.actionLabel).toBe("Acompanhar trabalho ativo");
	});
});
