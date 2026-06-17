import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

		it("auto moves to next stage by order", () => {
			const workflow = createTestWorkflow();
			workflow.items[0].stage = "backlog";
			saveWorkflow(tmpDir, workflow);

			flowMove(tmpDir, "ITEM-1", "", { auto: true });

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items[0].stage).toBe("design");
		});

		it("auto shows message when at last stage", () => {
			const workflow = createTestWorkflow();
			workflow.items[0].stage = "done";
			saveWorkflow(tmpDir, workflow);

			const logs: string[] = [];
			const origLog = console.log;
			console.log = (msg: string) => logs.push(msg);
			try {
				flowMove(tmpDir, "ITEM-1", "", { auto: true });
				expect(logs.some((l) => l.includes("already at the last stage"))).toBe(true);
				const loaded = JSON.parse(
					readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
				);
				expect(loaded.items[0].stage).toBe("done");
			} finally {
				console.log = origLog;
			}
		});

		it("auto errors when stage not found", () => {
			const workflow = createTestWorkflow();
			workflow.items[0].stage = "nonexistent";
			saveWorkflow(tmpDir, workflow);

			const origExit = process.exit;
			const origLog = console.log;
			let exitCode: number | undefined;
			process.exit = ((code?: number) => { exitCode = code; }) as any;
			try {
				flowMove(tmpDir, "ITEM-1", "", { auto: true });
				expect(exitCode).toBe(1);
			} finally {
				process.exit = origExit;
				console.log = origLog;
			}
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

		it("should regenerate adapter files after move", async () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			await flowMove(tmpDir, "ITEM-1", "Design");

			expect(existsSync(join(tmpDir, ".cursorrules"))).toBe(true);
			const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("@.letra/constitution.md");
			expect(content).toContain("@.letra/glossary.md");
		});

		it("should update workflow updatedAt after move", async () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const before = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			await flowMove(tmpDir, "ITEM-1", "design");

			const after = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(after.updatedAt).not.toBe(before.updatedAt);
		});

		it("should generate correct adapter content", async () => {
			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			await flowMove(tmpDir, "ITEM-1", "design");

			const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(content).toContain("letra flow move");
			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("## Regras");
		});

		it("should sync focus file when moved item has spec", async () => {
			const workflow = createTestWorkflow();
			workflow.items[0].spec = "my-feature";
			saveWorkflow(tmpDir, workflow);

			const specDir = join(tmpDir, ".letra", "specs", "my-feature");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(
				join(specDir, "spec.md"),
				"# Spec: My Feature\n\n## Outcome\nAllows cool things\n",
			);

			await flowMove(tmpDir, "ITEM-1", "design");

			const focusFile = join(tmpDir, ".letra", "focus.md");
			expect(existsSync(focusFile)).toBe(true);

			const focusContent = readFileSync(focusFile, "utf-8");
			expect(focusContent).toContain("# Focus: my-feature");
			expect(focusContent).toContain("**Item**: ITEM-1");
			expect(focusContent).toContain("**Outcome**: Allows cool things");
		});

		it("--auto blocks when item has pending ACs (AC2.5)", () => {
			const workflow = createTestWorkflow();
			workflow.items[0].spec = "my-feature";
			workflow.items[0].stage = "code";
			saveWorkflow(tmpDir, workflow);

			const specDir = join(tmpDir, ".letra", "specs", "my-feature");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(
				join(specDir, "spec.md"),
				"# Spec\n\n## Outcome\nTest\n\n## Acceptance Criteria\n- [ ] **AC1**: Pending AC\n- [ ] **AC2**: Another pending\n",
			);

			const logs: string[] = [];
			const origLog = console.log;
			console.log = (msg: string) => logs.push(msg);
			try {
				flowMove(tmpDir, "ITEM-1", "", { auto: true });
				expect(logs.some((l) => l.includes("pending AC"))).toBe(true);
				const loaded = JSON.parse(
					readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
				);
				expect(loaded.items[0].stage).toBe("code");
			} finally {
				console.log = origLog;
			}
		});

		it("--force bypasses pending AC check (AC2.5)", async () => {
			const workflow = createTestWorkflow();
			workflow.items[0].spec = "my-feature";
			workflow.items[0].stage = "code";
			saveWorkflow(tmpDir, workflow);

			const specDir = join(tmpDir, ".letra", "specs", "my-feature");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(
				join(specDir, "spec.md"),
				"# Spec\n\n## Outcome\nTest\n\n## Acceptance Criteria\n- [ ] **AC1**: Pending AC\n",
			);

			await flowMove(tmpDir, "ITEM-1", "", { auto: true, force: true });

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items[0].stage).toBe("review");
		});
	});
});
