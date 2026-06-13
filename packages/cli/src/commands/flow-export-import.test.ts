import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flowExport, flowImport } from "./flow-export-import.js";
import { type Workflow, saveWorkflow } from "./flow-init.js";

function createTestWorkflow(): Workflow {
	return {
		version: "1.0",
		name: "test-project",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "design", name: "Design", order: 1 },
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

function createImportWorkflow(): Workflow {
	return {
		version: "2.0",
		name: "imported-project",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "todo", name: "To Do", order: 0 },
			{ id: "done", name: "Done", order: 1 },
		],
		items: [],
		tools: ["opencode"],
	};
}

describe("flow-export-import", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-export-import-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("flowExport", () => {
		it("should show warning when no workflow exists", () => {
			flowExport(tmpDir);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("No workflow found"),
			);
		});

		it("should print formatted JSON", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowExport(tmpDir);
			const output = (console.log as ReturnType<typeof vi.spyOn>).mock
				.calls[0][0] as string;
			expect(output).toContain('"name": "test-project"');
			expect(output).toContain("  ");
		});

		it("should print minified JSON with --minified", () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);
			flowExport(tmpDir, { minified: true });
			const output = (console.log as ReturnType<typeof vi.spyOn>).mock
				.calls[0][0] as string;
			expect(output).toContain('"name":"test-project"');
			expect(output).not.toContain("  ");
		});
	});

	describe("flowImport", () => {
		it("should import valid workflow JSON", () => {
			const importData = createImportWorkflow();
			const importFile = join(tmpDir, "import.json");
			writeFileSync(importFile, JSON.stringify(importData, null, 2));

			flowImport(tmpDir, importFile);

			const saved = readFileSync(
				join(tmpDir, ".letra", "workflow.json"),
				"utf-8",
			);
			const parsed = JSON.parse(saved);
			expect(parsed.name).toBe("imported-project");
			expect(parsed.version).toBe("2.0");
			expect(parsed.stages).toHaveLength(2);
		});

		it("should create backup of existing workflow", () => {
			const existing = createTestWorkflow();
			saveWorkflow(tmpDir, existing);

			const importData = createImportWorkflow();
			const importFile = join(tmpDir, "import.json");
			writeFileSync(importFile, JSON.stringify(importData, null, 2));

			flowImport(tmpDir, importFile);

			const backupPath = join(tmpDir, ".letra", "workflow.v1.0.json");
			expect(existsSync(backupPath)).toBe(true);
			const backupContent = JSON.parse(readFileSync(backupPath, "utf-8"));
			expect(backupContent.name).toBe("test-project");
		});

		it("should reject invalid JSON", () => {
			const importFile = join(tmpDir, "invalid.json");
			writeFileSync(importFile, "not json");

			expect(() => flowImport(tmpDir, importFile)).toThrow();
		});

		it("should reject JSON without stages", () => {
			const importFile = join(tmpDir, "no-stages.json");
			writeFileSync(importFile, JSON.stringify({ name: "test" }));

			expect(() => flowImport(tmpDir, importFile)).toThrow();
		});

		it("should reject JSON with empty name", () => {
			const importFile = join(tmpDir, "empty-name.json");
			writeFileSync(
				importFile,
				JSON.stringify({
					name: "",
					stages: [{ id: "a", name: "A", order: 0 }],
				}),
			);

			expect(() => flowImport(tmpDir, importFile)).toThrow();
		});

		it("should reject JSON with empty stages array", () => {
			const importFile = join(tmpDir, "empty-stages.json");
			writeFileSync(importFile, JSON.stringify({ name: "test", stages: [] }));

			expect(() => flowImport(tmpDir, importFile)).toThrow();
		});

		it("should not create backup when no existing workflow", () => {
			const importData = createImportWorkflow();
			const importFile = join(tmpDir, "import.json");
			writeFileSync(importFile, JSON.stringify(importData, null, 2));

			flowImport(tmpDir, importFile);

			const backupPath = join(tmpDir, ".letra", "workflow.v2.0.json");
			expect(existsSync(backupPath)).toBe(false);
		});
	});
});
