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
import { backlogAdd, backlogList } from "./flow-backlog.js";
import { type Workflow, saveWorkflow } from "./flow-init.js";

function createTestWorkflow(): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "doing", name: "Doing", order: 1 },
			{ id: "done", name: "Done", order: 2 },
		],
		items: [],
		tools: ["cursor"],
	};
}

describe("flow-backlog", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-backlog-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("backlogAdd", () => {
		it("should add item to first stage", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			backlogAdd(tmpDir, "My first task");

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items).toHaveLength(1);
			expect(loaded.items[0].description).toBe("My first task");
			expect(loaded.items[0].stage).toBe("backlog");
			expect(loaded.items[0].id).toBe("ITEM-1");
		});

		it("should auto-increment item IDs", () => {
			const workflow = createTestWorkflow();
			workflow.items.push({
				id: "ITEM-1",
				description: "Existing",
				stage: "backlog",
				createdAt: "2026-01-01T00:00:00.000Z",
			});
			saveWorkflow(tmpDir, workflow);

			backlogAdd(tmpDir, "Second task");

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items).toHaveLength(2);
			expect(loaded.items[1].id).toBe("ITEM-2");
		});

		it("should update workflow updatedAt", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const before = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			backlogAdd(tmpDir, "Task");

			const after = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(after.updatedAt).not.toBe(before.updatedAt);
		});
	});

	describe("backlogList", () => {
		it("should print empty message when no items", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const result = backlogList(tmpDir);
			expect(result).toBeUndefined();
		});

		it("should list items when they exist", () => {
			const workflow = createTestWorkflow();
			workflow.items.push({
				id: "ITEM-1",
				description: "Task A",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			});
			saveWorkflow(tmpDir, workflow);

			const result = backlogList(tmpDir);
			expect(result).toBeUndefined();
		});
	});
});
