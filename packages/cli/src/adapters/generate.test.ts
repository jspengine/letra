import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHarnessSnapshot } from "./builder.js";
import { formatAdapterContent } from "./formatters.js";
import { generateAdapters } from "./generate.js";

describe("adapters", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-adapters-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("buildHarnessSnapshot", () => {
		it("returns init snapshot without workflow", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			expect(snapshot.hasWorkflow).toBe(false);
			expect(snapshot.items).toEqual([]);
			expect(snapshot.hasFocus).toBe(false);
		});

		it("detects focus.md when present", () => {
			writeFileSync(join(tmpDir, ".letra", "focus.md"), "# Focus: test\n");
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			expect(snapshot.hasFocus).toBe(true);
		});

		it("filters items by active stage", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [
						{ id: "backlog", name: "Backlog" },
						{ id: "code", name: "Code" },
					],
					items: [
						{ id: "ITEM-1", description: "Task A", stage: "code" },
						{ id: "ITEM-2", description: "Task B", stage: "backlog" },
					],
				},
				activeStageId: "code",
			});

			expect(snapshot.hasWorkflow).toBe(true);
			expect(snapshot.activeStage?.name).toBe("Code");
			expect(snapshot.items).toHaveLength(1);
			expect(snapshot.items[0].id).toBe("ITEM-1");
		});
	});

	describe("formatAdapterContent", () => {
		it("includes L1 @ references for cursor init", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "at", {
				source: "init",
				displayName: "Cursor",
			});

			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("@.letra/constitution.md");
			expect(content).toContain("@.letra/glossary.md");
			expect(content).toContain("# Rules");
		});

		it("includes L1 path list for text format", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "text", {
				source: "init",
				displayName: "OpenCode",
			});

			expect(content).toContain("- .letra/context.md");
			expect(content).toContain("- .letra/constitution.md");
		});

		it("composes L1 + L2 + L3 + Regras for flow-move", () => {
			const specDir = join(tmpDir, ".letra", "specs", "ruler-header");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(
				join(specDir, "spec.md"),
				"# Spec: Ruler Header\n\n## Acceptance Criteria\n- [ ] **AC 1**: Desc\n- [x] **AC 2**: Desc\n",
			);
			writeFileSync(join(tmpDir, ".letra", "focus.md"), "# Focus: ruler-header\n");

			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-33", description: "ruler header", stage: "code", spec: "ruler-header" }],
				},
				activeStageId: "code",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("@.letra/focus.md");
			expect(content).toContain("**Estagio atual:** Code");
			expect(content).toContain("ITEM-33: ruler header");
			expect(content).toContain("- spec: .letra/specs/ruler-header/spec.md");
			expect(content).toContain("- acceptance: .letra/specs/ruler-header/acceptance.md");
			expect(content).toContain("## Sinais de trabalho");
			expect(content).toContain("**Item primario:** ITEM-33 (ruler-header)");
			expect(content).toContain("**ACs:** 1/2 pendentes");
			expect(content).toContain("## Regras");
		});

		it("includes tasks count in L3 signals if present", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [
						{
							id: "ITEM-33",
							description: "ruler header",
							stage: "code",
							tasks: [
								{ id: "task-1", description: "First task", done: false },
								{ id: "task-2", description: "Second task", done: true },
							],
						},
					],
				},
				activeStageId: "code",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("**Tasks:** 1/2 abertas");
		});

		it("includes ac-source-drift alert in L3 if AC counts differ", () => {
			const specDir = join(tmpDir, ".letra", "specs", "ruler-header");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(
				join(specDir, "spec.md"),
				"# Spec\n\n## Acceptance Criteria\n- [ ] **AC 1**: Desc\n",
			);
			writeFileSync(
				join(specDir, "acceptance.md"),
				"# Acceptance\n- [ ] **AC 1**: Desc\n- [ ] **AC 2**: Desc\n",
			);

			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-33", description: "ruler header", stage: "code", spec: "ruler-header" }],
				},
				activeStageId: "code",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("⚠ ac-source-drift: spec.md=1, acceptance.md=2");
		});
	});

	describe("generateAdapters", () => {
		it("writes cursor adapter with L1 after flow-move", () => {
			generateAdapters(tmpDir, ["cursor"], {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [{ id: "design", name: "Design" }],
					items: [{ id: "ITEM-1", description: "First task", stage: "design" }],
				},
				activeStageId: "design",
				quiet: true,
			});

			const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(content).toContain("Gerado por letra flow move");
			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("Design");
			expect(content).toContain("ITEM-1: First task");
		});

		it("writes opencode adapter with path list on init", () => {
			generateAdapters(tmpDir, ["opencode"], { source: "init", quiet: true });

			const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			expect(content).toContain("Generated by letra init");
			expect(content).toContain("- .letra/context.md");
			expect(content).toContain("OpenCode Adapter");
		});

		it("generates adapters for multiple tools in single event", () => {
			generateAdapters(tmpDir, ["cursor", "opencode", "vscode"], {
				source: "init",
				quiet: true,
			});

			// Assert all 3 files exist
			expect(existsSync(join(tmpDir, ".cursorrules"))).toBe(true);
			expect(existsSync(join(tmpDir, "AGENTS.md"))).toBe(true);
			expect(existsSync(join(tmpDir, ".github/copilot-instructions.md"))).toBe(true);

			// Assert cursor has @ format
			const cursor = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
			expect(cursor).toContain("@.letra/context.md");

			// Assert opencode has bullet format
			const opencode = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			expect(opencode).toContain("- .letra/context.md");

			// Assert vscode has bullet format
			const vscode = readFileSync(join(tmpDir, ".github/copilot-instructions.md"), "utf-8");
			expect(vscode).toContain("- .letra/context.md");
		});
	});
});
