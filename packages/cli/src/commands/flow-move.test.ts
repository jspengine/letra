import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Workflow, saveWorkflow } from "./flow-init.js";
import { flowMove } from "./flow-move.js";

function createTestWorkflow(): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "design", name: "Design", order: 1 },
			{ id: "code", name: "Code", order: 2 },
			{ id: "review", name: "Review", order: 3 },
			{ id: "done", name: "Done", order: 4 },
		],
		items: [
			{
				id: "ITEM-1",
				description: "First task",
				stage: "backlog",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		tools: ["cursor"],
	};
}

describe("flow-move", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-move-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("flowMove", () => {
		it("should move item to target stage by id", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			flowMove(tmpDir, "ITEM-1", "design");

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items[0].stage).toBe("design");
		});

		it("should move item to target stage by name", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			flowMove(tmpDir, "ITEM-1", "Design");

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items[0].stage).toBe("design");
		});

		it("should regenerate adapter files after move", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			flowMove(tmpDir, "ITEM-1", "Design");

			expect(existsSync(join(tmpDir, ".cursorrules"))).toBe(true);
			const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(content).toContain("Design");
			expect(content).toContain("ITEM-1");
		});

		it("should update workflow updatedAt after move", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const before = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			flowMove(tmpDir, "ITEM-1", "design");

			const after = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(after.updatedAt).not.toBe(before.updatedAt);
		});

		it("should generate correct adapter content", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			flowMove(tmpDir, "ITEM-1", "design");

			const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(content).toContain("Design");
			expect(content).toContain("ITEM-1: First task");
			expect(content).toContain("letra flow move <id> --to");
		});
	});
});
