import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flowBoard } from "./flow-board.js";
import { type Workflow, saveWorkflow } from "./flow-init.js";

function createTestWorkflow(extraItems = 0): Workflow {
	const items = [
		{
			id: "ITEM-1",
			description: "First task",
			stage: "backlog",
			createdAt: "2026-01-01T00:00:00.000Z",
		},
	];
	for (let i = 0; i < extraItems; i++) {
		items.push({
			id: `ITEM-${i + 2}`,
			description: `Task ${i + 2}`,
			stage: i % 2 === 0 ? "design" : "code",
			createdAt: "2026-01-01T00:00:00.000Z",
		});
	}
	return {
		version: "1.0",
		name: "test-project",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "design", name: "Design", order: 1 },
			{ id: "code", name: "Code", order: 2 },
			{ id: "review", name: "Review", order: 3 },
			{ id: "done", name: "Done", order: 4 },
		],
		items: items as Workflow["items"],
		tools: ["cursor"],
	};
}

describe("flow-board", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-board-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("flowBoard", () => {
		it("should show warning when no workflow exists", () => {
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No workflow found"));
		});

		it("should show board header with project name", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("test-project"));
		});

		it("should show empty stage label", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("(empty)"));
		});

		it("should show item count per stage", () => {
			const workflow = createTestWorkflow(2);
			saveWorkflow(tmpDir, workflow);
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1 item"));
		});

		it("should show item id and description", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ITEM-1"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("First task"));
		});

		it("should show items distributed across stages", () => {
			const workflow = createTestWorkflow(4);
			saveWorkflow(tmpDir, workflow);
			flowBoard(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Backlog"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Design"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Code"));
		});
	});
});
