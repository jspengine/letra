import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type Workflow,
	detectExistingTools,
	detectProjectName,
	flowInit,
	loadWorkflow,
	saveWorkflow,
	stagesFromInput,
} from "./flow-init.js";

describe("flow-init", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	describe("stagesFromInput", () => {
		it("should parse comma-separated stages", () => {
			const stages = stagesFromInput("backlog, design, code, review, done");
			expect(stages).toHaveLength(5);
			expect(stages[0]).toEqual({ id: "backlog", name: "Backlog", order: 0 });
			expect(stages[1]).toEqual({ id: "design", name: "Design", order: 1 });
			expect(stages[2]).toEqual({ id: "code", name: "Code", order: 2 });
			expect(stages[3]).toEqual({ id: "review", name: "Review", order: 3 });
			expect(stages[4]).toEqual({ id: "done", name: "Done", order: 4 });
		});

		it("should handle single stage", () => {
			const stages = stagesFromInput("todo");
			expect(stages).toHaveLength(1);
			expect(stages[0]).toEqual({ id: "todo", name: "Todo", order: 0 });
		});

		it("should generate valid ids from special characters", () => {
			const stages = stagesFromInput("Em Desenvolvimento, Pronto pra Review");
			expect(stages[0].id).toBe("em-desenvolvimento");
			expect(stages[1].id).toBe("pronto-pra-review");
		});

		it("should return empty array for empty input", () => {
			const stages = stagesFromInput("");
			expect(stages).toHaveLength(0);
		});
	});

	describe("detectProjectName", () => {
		it("should return package.json name", () => {
			writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "@letra-ai/cli" }));
			expect(detectProjectName(tmpDir)).toBe("cli");
		});

		it("should fallback to directory name", () => {
			expect(detectProjectName(tmpDir)).toBe(tmpDir.split(/[\\/]/).pop());
		});
	});

	describe("detectExistingTools", () => {
		it("should detect all adapters", () => {
			writeFileSync(join(tmpDir, ".cursorrules"), "");
			writeFileSync(join(tmpDir, "CLAUDE.md"), "");
			writeFileSync(join(tmpDir, ".windsurfrules"), "");
			writeFileSync(join(tmpDir, "AGENTS.md"), "");
			mkdirSync(join(tmpDir, ".codex"), { recursive: true });
			writeFileSync(join(tmpDir, ".codex", "config.toml"), "");
			mkdirSync(join(tmpDir, ".github"), { recursive: true });
			writeFileSync(join(tmpDir, ".github", "copilot-instructions.md"), "");

			const tools = detectExistingTools(tmpDir);
			expect(tools).toContain("cursor");
			expect(tools).toContain("claude-code");
			expect(tools).toContain("windsurf");
			expect(tools).toContain("opencode");
			expect(tools).toContain("codex");
			expect(tools).toContain("vscode");
		});

		it("should return empty array when no adapters exist", () => {
			expect(detectExistingTools(tmpDir)).toEqual([]);
		});
	});

	describe("saveWorkflow and loadWorkflow", () => {
		it("should round-trip workflow", () => {
			const workflow: Workflow = {
				version: "1.0",
				name: "test",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				stages: [{ id: "todo", name: "Todo", order: 0 }],
				items: [],
				tools: ["cursor"],
			};

			saveWorkflow(tmpDir, workflow);

			const loaded = loadWorkflow(tmpDir);
			expect(loaded).toEqual(workflow);
		});

		it("should return null when no workflow file", () => {
			expect(loadWorkflow(tmpDir)).toBeNull();
		});

		it("should create .letra directory if missing", () => {
			const workflow: Workflow = {
				version: "1.0",
				name: "test",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				stages: [],
				items: [],
				tools: [],
			};

			saveWorkflow(tmpDir, workflow);
			expect(existsSync(join(tmpDir, ".letra"))).toBe(true);
			expect(existsSync(join(tmpDir, ".letra", "workflow.json"))).toBe(true);
		});

		it("migrates legacy targets into locations when loading workflow", () => {
			mkdirSync(join(tmpDir, ".letra"), { recursive: true });
			writeFileSync(
				join(tmpDir, ".letra", "workflow.json"),
				JSON.stringify({
					version: "1.0",
					name: "legacy",
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
					stages: [],
					items: [],
					tools: [],
					locations: [
						{ id: "loc-app", path: "C:/Workspace/app", label: "app" },
						{
							id: "loc-api",
							path: "C:/Workspace/api",
							label: "api",
							adapters: ["codex"],
						},
					],
					targets: [
						{
							id: "target-api",
							path: "C:/Workspace/api",
							adapters: ["cursor", "codex"],
						},
						{ id: "target-web", path: "C:/Workspace/web", adapters: ["opencode"] },
					],
				}),
				"utf-8",
			);

			const loaded = loadWorkflow(tmpDir);
			expect(loaded?.targets).toBeUndefined();
			expect(loaded?.locations).toEqual([
				{ id: "loc-app", path: "C:/Workspace/app", label: "app", adapters: [] },
				{
					id: "loc-api",
					path: "C:/Workspace/api",
					label: "api",
					adapters: ["codex", "cursor"],
				},
				{ id: "loc-web", path: "C:/Workspace/web", label: "web", adapters: ["opencode"] },
			]);

			const persisted = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(persisted.targets).toBeUndefined();
			expect(persisted.locations).toEqual(loaded?.locations);
		});
	});

	describe("flowInit (non-TTY)", () => {
		it("should return workflow with defaults when used with --quick", async () => {
			const workflow = await flowInit(tmpDir, { quick: true });
			expect(workflow.name).toBe(tmpDir.split(/[\\/]/).pop());
			expect(workflow.stages).toHaveLength(5);
			expect(workflow.version).toBe("1.0");
			expect(workflow.items).toEqual([]);
		});

		it("should use detected tools", async () => {
			writeFileSync(join(tmpDir, "AGENTS.md"), "");
			writeFileSync(join(tmpDir, ".cursorrules"), "");

			const workflow = await flowInit(tmpDir, { quick: true });
			expect(workflow.tools).toContain("opencode");
			expect(workflow.tools).toContain("cursor");
		});

		it("should preserve an unknown template id while using the explicit bootstrap fallback", async () => {
			const workflow = await flowInit(tmpDir, { quick: true, template: "custom-flow" });

			expect(workflow.template).toBe("custom-flow");
			expect(workflow.stages.map((stage) => stage.id)).toEqual([
				"backlog",
				"design",
				"code",
				"review",
				"done",
			]);
		});
	});
});
