import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Workflow, saveWorkflow } from "./flow-init.js";
import { flowVisualize } from "./flow-visualize.js";

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

describe("flow-visualize", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-visualize-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("flowVisualize", () => {
		it("should show warning when no workflow exists", () => {
			flowVisualize(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No workflow found"));
		});

		it("should output mermaid diagram to console", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowVisualize(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("flowchart LR"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Backlog"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Design"));
		});

		it("should save diagram to file when output option is given", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			const outputFile = "flowchart.md";
			flowVisualize(tmpDir, { output: outputFile });
			const outputPath = join(tmpDir, outputFile);
			expect(existsSync(outputPath)).toBe(true);
			const content = readFileSync(outputPath, "utf-8");
			expect(content).toContain("flowchart LR");
			expect(content).toContain("Backlog");
		});

		it("should show item counts in diagram", () => {
			const workflow = createTestWorkflow(2);
			saveWorkflow(tmpDir, workflow);
			flowVisualize(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1 item"));
		});

		it("should handle empty stages showing zero items", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowVisualize(tmpDir);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("0 items"));
		});

		it("should include all stages in diagram", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowVisualize(tmpDir);
			for (const stage of workflow.stages) {
				expect(console.log).toHaveBeenCalledWith(expect.stringContaining(stage.name));
			}
		});
	});
});
