import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flowDiff, flowEdit } from "./flow-edit-diff.js";
import { type Workflow, loadWorkflow, saveWorkflow } from "./flow-init.js";

function createTestWorkflow(overrides?: Partial<Workflow>): Workflow {
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
		items: [
			{
				id: "ITEM-1",
				description: "First task",
				stage: "backlog",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		tools: ["cursor"],
		...overrides,
	};
}

describe("flow-edit-diff", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-edit-diff-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("flowEdit", () => {
		it("should update workflow name", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Novo Nome" });
			const loaded = loadWorkflow(tmpDir);
			expect(loaded?.name).toBe("Novo Nome");
		});

		it("should update workflow description", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { desc: "Uma descricao" });
			const loaded = loadWorkflow(tmpDir);
			expect(loaded?.description).toBe("Uma descricao");
		});

		it("should update name and description together", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Novo", desc: "Desc" });
			const loaded = loadWorkflow(tmpDir);
			expect(loaded?.name).toBe("Novo");
			expect(loaded?.description).toBe("Desc");
		});

		it("should increment version on edit", () => {
			const workflow = createTestWorkflow({ version: "1.0" });
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Novo" });
			const loaded = loadWorkflow(tmpDir);
			expect(loaded?.version).toBe("1.1.0");
		});

		it("should save backup of previous version", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Novo" });
			const backupPath = join(tmpDir, ".letra", "workflow.v1.0.0.json");
			expect(existsSync(backupPath)).toBe(true);
			const backup = JSON.parse(readFileSync(backupPath, "utf-8"));
			expect(backup.name).toBe("test-project");
			expect(backup.version).toBe("1.0");
		});

		it("should show warning when no workflow exists", () => {
			flowEdit(tmpDir, { name: "Novo" });
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("No workflow found"),
			);
		});
	});

	describe("flowDiff", () => {
		it("should show diff between current and last backup", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Novo Nome" });
			flowDiff(tmpDir);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Novo Nome"),
			);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("test-project"),
			);
		});

		it("should show diff between specific versions", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowEdit(tmpDir, { name: "Edit 1" });
			flowEdit(tmpDir, { name: "Edit 2" });
			flowDiff(tmpDir, "1.0.0", "1.1.0");
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Edit 1"),
			);
		});

		it("should show message when no workflow found", () => {
			flowDiff(tmpDir);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("No workflow found"),
			);
		});

		it("should show message when no backup found", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowDiff(tmpDir);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("No backup versions found"),
			);
		});
	});
});
