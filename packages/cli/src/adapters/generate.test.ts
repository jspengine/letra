import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHarnessSnapshot } from "./builder.js";
import { formatAdapterContent } from "./formatters.js";
import { generateAdapters, renderAdapterFiles } from "./generate.js";

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

		it("composes L1 + Regras for flow-move", () => {
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
					items: [
						{
							id: "ITEM-33",
							description: "ruler header",
							stage: "code",
							spec: "ruler-header",
						},
					],
				},
				activeStageId: "code",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("@.letra/context.md");
			expect(content).toContain("@.letra/focus.md");
			expect(content).toContain("## Regras");
			expect(content).not.toContain("ITEM-33:");
			expect(content).not.toContain("## Sinais de trabalho");
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

			expect(content).not.toContain("**Tasks:**");
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
					items: [
						{
							id: "ITEM-33",
							description: "ruler header",
							stage: "code",
							spec: "ruler-header",
						},
					],
				},
				activeStageId: "code",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).not.toContain("ac-source-drift");
		});

		it("includes protocol section when workflow exists with active item", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("PASSO OBRIGATÓRIO #1");
			expect(content).toContain("PASSO OBRIGATÓRIO #2");
			expect(content).toContain("PASSO OBRIGATÓRIO #3");
			expect(content).toContain("PASSO OBRIGATÓRIO #4");
			expect(content).not.toContain("Se não há item ativo");
		});

		it("includes protocol section with fallback when no active item", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "backlog", name: "Backlog" }],
					items: [],
				},
				activeStageId: "backlog",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("PASSO OBRIGATÓRIO #1");
			expect(content).toContain("Identifique o item ativo via `letra pulse`");
			expect(content).not.toContain("Trabalhe no item ativo");
		});

		it("omits kickoff section when no workflow", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "text", {
				source: "init",
				displayName: "OpenCode",
			});
			expect(content).not.toContain("Checklist de Início");
		});

		it("adapter shows next stage info with multiple stages and order", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [
						{ id: "backlog", name: "Backlog", order: 0 },
						{ id: "design", name: "Design", order: 1 },
						{ id: "code", name: "Code", order: 2 },
					],
					items: [
						{
							id: "ITEM-1",
							description: "First task",
							stage: "design",
							spec: "my-feature",
						},
					],
				},
				activeStageId: "design",
				primaryItemId: "ITEM-1",
			});

			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});
		});
	});

	describe("formatL5 alerts section", () => {
		it("omits alert section when no alerts", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "at", {
				source: "init",
				displayName: "Cursor",
			});
			expect(content).not.toContain("Pendências Detectadas");
		});

		it("includes formatted alerts when present", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			snapshot.alerts = [
				{
					id: "alert-snapshot-bloat",
					severity: "media",
					title: "Snapshot excede 1MB",
					source: "detector-snapshot-bloat",
					detectedAt: "2026-06-01T10:00:00.000Z",
				},
			];
			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("## Alertas");
			expect(content).toContain("Alerta · severidade média");
			expect(content).toContain("ID: alert-snapshot-bloat");
			expect(content).toContain("O que: Snapshot excede 1MB");
			expect(content).toContain("Onde: detector-snapshot-bloat");
			expect(content).toContain("Ação: `letra health ack alert-snapshot-bloat`");
		});

		it("handles overflow alert count", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			snapshot.alerts = [
				{
					id: "alert-1",
					severity: "alta",
					title: "Alta severity alert",
					source: "detector-1",
					detectedAt: "2026-06-01T10:00:00.000Z",
				},
				{
					id: "...",
					severity: "",
					title: "e mais 2 alertas",
					source: "",
					detectedAt: "",
				},
			];
			const content = formatAdapterContent(snapshot, "at", {
				source: "flow-move",
				displayName: "Cursor",
			});

			expect(content).toContain("## ⚠ ATENÇÃO");
			expect(content).toContain("severidade alta");
			expect(content).toContain("e mais 2 alertas");
		});

		it("buildHarnessSnapshot loads alerts from health record when novo entries exist", () => {
			const healthDir = join(tmpDir, ".letra");
			mkdirSync(healthDir, { recursive: true });
			writeFileSync(
				join(healthDir, "health-record.json"),
				JSON.stringify({
					schemaVersion: 1,
					lastScanAt: "2026-06-10T12:00:00.000Z",
					entries: [
						{
							id: "drift-ruler-header",
							type: "warning",
							severity: "media",
							title: "Spec drift detected",
							source: "spec-code-drift",
							status: "novo",
							detectedAt: "2026-06-10T12:00:00.000Z",
							resolvedAt: null,
							dismissedAt: null,
							dismissReason: null,
							acknowledgedAt: null,
						},
						{
							id: "bloat-snapshots",
							type: "error",
							severity: "alta",
							title: "Snapshot bloat",
							source: "snapshot-bloat",
							status: "novo",
							detectedAt: "2026-06-10T12:00:00.000Z",
							resolvedAt: null,
							dismissedAt: null,
							dismissReason: null,
							acknowledgedAt: null,
						},
						{
							id: "old-ack",
							type: "info",
							severity: "baixa",
							title: "Already acked",
							source: "some-detector",
							status: "ciente",
							detectedAt: "2026-06-10T12:00:00.000Z",
							resolvedAt: null,
							dismissedAt: null,
							dismissReason: null,
							acknowledgedAt: null,
						},
					],
				}),
			);

			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});

			expect(snapshot.alerts).toBeDefined();
			expect(snapshot.alerts).toHaveLength(2);
			expect(snapshot.alerts).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ id: "drift-ruler-header" }),
					expect.objectContaining({ id: "bloat-snapshots" }),
				]),
			);
			expect(snapshot.alerts).not.toEqual(
				expect.arrayContaining([expect.objectContaining({ id: "old-ack" })]),
			);
		});

		it("caps alerts at 5 with overflow entry", () => {
			const healthDir = join(tmpDir, ".letra");
			mkdirSync(healthDir, { recursive: true });
			const entries = Array.from({ length: 7 }, (_, i) => ({
				id: `alert-${i}`,
				type: "info" as const,
				severity: "baixa" as const,
				title: `Alert ${i}`,
				source: "test",
				status: "novo" as const,
				detectedAt: "2026-06-10T12:00:00.000Z",
				resolvedAt: null,
				dismissedAt: null,
				dismissReason: null,
				acknowledgedAt: null,
			}));
			writeFileSync(
				join(healthDir, "health-record.json"),
				JSON.stringify({
					schemaVersion: 1,
					lastScanAt: "2026-06-10T12:00:00.000Z",
					entries,
				}),
			);

			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});

			expect(snapshot.alerts).toBeDefined();
			expect(snapshot.alerts).toHaveLength(6);
			expect(snapshot.alerts?.[5]).toEqual({
				id: "...",
				severity: "",
				title: "e mais 2 alertas",
				source: "",
				detectedAt: "",
			});
		});
	});

	describe("formatCommandMenu", () => {
		it("appears when workflow exists", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("## Comandos");
		});

		it("omitted without workflow", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "text", {
				source: "init",
				displayName: "OpenCode",
			});
			expect(content).not.toContain("## Comandos");
		});

		it("has categories: Leitura, Escrita", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("Leitura (seguro — não muda nada):");
			expect(content).toContain("Escrita (muda estado):");
		});

		it("has correct command counts by category", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			const lines = content.split("\n");
			const cmdLines = lines.filter((l) => l.trimStart().startsWith("`letra"));
			expect(cmdLines).toHaveLength(12);
		});

		it("each command is inline code with one-line description", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			const lines = content.split("\n");
			const cmdLines = lines.filter((l) => l.trimStart().startsWith("`letra"));
			for (const cmd of cmdLines) {
				expect(cmd).toMatch(/`letra/);
				expect(cmd).toContain("—");
			}
		});

		it("no duplicate commands across categories", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			const lines = content.split("\n");
			const cmdLines = lines.filter((l) => l.trimStart().startsWith("`letra"));
			const cmds = cmdLines.map((l) => l.trim().split("—")[0].trim());
			expect(new Set(cmds).size).toBe(cmds.length);
		});

		it("works without health-record or sitrep data", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("## Comandos");
			expect(content).toContain("`letra pulse`");
			expect(content).toContain("`letra validate`");
		});

		it("regenerated when adapters are generated", () => {
			generateAdapters(tmpDir, ["opencode"], {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
				quiet: true,
			});
			const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			expect(content).toContain("## Comandos");
			expect(content).toContain("`letra pulse`");
		});
	});

	describe("formatCompletionChecklist", () => {
		it("appears when workflow exists", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("## Checklist de Encerramento");
		});

		it("omitted without workflow", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
			const content = formatAdapterContent(snapshot, "text", {
				source: "init",
				displayName: "OpenCode",
			});
			expect(content).not.toContain("Checklist de Encerramento");
		});

		it("describes three states: CONTINUE, BLOCKED, ALL_DONE", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("**CONTINUE**");
			expect(content).toContain("**BLOCKED**");
			expect(content).toContain("**ALL_DONE**");
		});

		it("instructs to use pulse --json for state detection", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("`letra pulse --json`");
		});

		it("BLOCKED state tells agent to report ", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("aguardando humano");
			expect(content).toContain("aguardando revisão");
		});

		it("ALL_DONE state instructs mission complete report", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain("missão completa");
		});

		it("CONTINUE state has session time limit guidance", () => {
			const snapshot = buildHarnessSnapshot(tmpDir, {
				source: "flow-move",
				workflow: {
					name: "letra",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
			});
			const content = formatAdapterContent(snapshot, "text", {
				source: "flow-move",
				displayName: "OpenCode",
			});
			expect(content).toContain(">30 min");
		});

		it("regenerated when adapters are generated", () => {
			generateAdapters(tmpDir, ["opencode"], {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [{ id: "code", name: "Code" }],
					items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
				},
				activeStageId: "code",
				quiet: true,
			});
			const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			expect(content).toContain("## Checklist de Encerramento");
			expect(content).toContain("**CONTINUE**");
		});
	});

	describe("generateAdapters", () => {
		it("renders a shared artifact once with deterministic content regardless of adapter order", () => {
			const first = renderAdapterFiles(tmpDir, ["opencode", "codex"], {
				source: "init",
				quiet: true,
			});
			const reversed = renderAdapterFiles(tmpDir, ["codex", "opencode"], {
				source: "init",
				quiet: true,
			});

			expect(first.filter((file) => file.path === "AGENTS.md")).toHaveLength(1);
			expect(reversed.filter((file) => file.path === "AGENTS.md")).toHaveLength(1);
			expect(first).toEqual(reversed);
			expect(first.find((file) => file.path === "AGENTS.md")?.content).toContain(
				"Letra Context — OpenCode + Codex Adapter",
			);
		});

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
			expect(content).not.toContain("ITEM-1:");
		});

		it("writes opencode adapter with path list on init", () => {
			generateAdapters(tmpDir, ["opencode"], { source: "init", quiet: true });

			const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			const opencodeContent = readFileSync(
				join(tmpDir, ".opencode", "instructions.md"),
				"utf-8",
			);
			expect(content).toContain("Generated by letra init");
			expect(content).toContain("- .letra/context.md");
			expect(content).toContain("OpenCode + Codex Adapter");
			expect(opencodeContent).toContain("OpenCode Adapter");
		});

		it("adds clickable file links for rules, focus, spec and active item", () => {
			const specDir = join(tmpDir, ".letra", "specs", "auth");
			mkdirSync(specDir, { recursive: true });
			writeFileSync(join(specDir, "spec.md"), "# Spec: Auth\n");
			writeFileSync(join(tmpDir, ".letra", "focus.md"), "# Focus: auth\n**Item**: ITEM-1\n");
			writeFileSync(join(tmpDir, ".letra", "workflow.json"), "{}");

			generateAdapters(tmpDir, ["opencode"], {
				source: "flow-move",
				workflow: {
					name: "test",
					stages: [{ id: "code", name: "Code" }],
					items: [
						{
							id: "ITEM-1",
							description: "Authentication",
							stage: "code",
							spec: "auth",
						},
					],
				},
				activeStageId: "code",
				primaryItemId: "ITEM-1",
				quiet: true,
			});

			const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
			expect(content).toContain(
				`[Constitution](${pathToFileURL(join(tmpDir, ".letra", "constitution.md")).href})`,
			);
			expect(content).toContain(
				`[Focus](${pathToFileURL(join(tmpDir, ".letra", "focus.md")).href})`,
			);
			expect(content).toContain(
				`[Spec: auth](${pathToFileURL(join(specDir, "spec.md")).href})`,
			);
			expect(content).toContain(
				`[ITEM-1](${pathToFileURL(join(tmpDir, ".letra", "workflow.json")).href})`,
			);
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

		describe("handoff section", () => {
			it("AC1: appears when there is a primary item", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
							{ id: "review", name: "Review", order: 2 },
						],
						items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
					},
					activeStageId: "code",
					primaryItemId: "ITEM-1",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).toContain("Após completar uma ação");
				expect(content).toContain("letra flow move ITEM-1");
				expect(content).toContain("review");
			});

			it("AC5: does not appear without primary item", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog" },
							{ id: "code", name: "Code" },
						],
						items: [],
					},
					activeStageId: "code",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).not.toContain("Após completar uma ação");
			});

			it("AC6: disabled via handoff: false", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
						],
						items: [{ id: "ITEM-1", description: "Task", stage: "code" }],
						handoff: false as any,
					},
					activeStageId: "code",
					primaryItemId: "ITEM-1",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).not.toContain("Após completar uma ação");
			});

			it("AC7: customSteps appear in output", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
						],
						items: [{ id: "ITEM-1", description: "Task", stage: "code" }],
						handoff: {
							customSteps: [
								{ command: "letra test", label: "custom step", recovery: "fix it" },
							],
						},
					},
					activeStageId: "code",
					primaryItemId: "ITEM-1",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).toContain("letra test");
				expect(content).toContain("custom step");
				expect(content).toContain("fix it");
			});

			it("AC8: skipSteps removes default steps", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
						],
						items: [{ id: "ITEM-1", description: "Task", stage: "code" }],
						handoff: {
							skipSteps: ["build"],
						},
					},
					activeStageId: "code",
					primaryItemId: "ITEM-1",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).not.toContain("npm run build");
				expect(content).toContain("letra validate");
			});

			it("AC4: recovery paths present for each step", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
						],
						items: [{ id: "ITEM-1", description: "Task", stage: "code" }],
					},
					activeStageId: "code",
					primaryItemId: "ITEM-1",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).toContain("❌ Se falhar");
				expect(content).toContain("letra diagnose");
			});

			it("AC9: uses item ID in flow move command", () => {
				const snapshot = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
							{ id: "review", name: "Review", order: 2 },
						],
						items: [{ id: "ITEM-42", description: "Special task", stage: "code" }],
					},
					activeStageId: "code",
					primaryItemId: "ITEM-42",
				});
				const content = formatAdapterContent(snapshot, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(content).toContain("ITEM-42");
				expect(content).toContain("review");
			});

			it("AC10: regenerated when item changes (different ID)", () => {
				const snapshot1 = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
							{ id: "review", name: "Review", order: 2 },
						],
						items: [{ id: "ITEM-A", description: "Old", stage: "code" }],
					},
					activeStageId: "code",
					primaryItemId: "ITEM-A",
				});
				const snapshot2 = buildHarnessSnapshot(tmpDir, {
					source: "flow-move",
					workflow: {
						name: "test",
						stages: [
							{ id: "backlog", name: "Backlog", order: 0 },
							{ id: "code", name: "Code", order: 1 },
							{ id: "review", name: "Review", order: 2 },
						],
						items: [{ id: "ITEM-B", description: "New", stage: "code" }],
					},
					activeStageId: "code",
					primaryItemId: "ITEM-B",
				});
				const c1 = formatAdapterContent(snapshot1, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				const c2 = formatAdapterContent(snapshot2, "text", {
					source: "flow-move",
					displayName: "Test",
				});
				expect(c1).toContain("ITEM-A");
				expect(c2).toContain("ITEM-B");
				expect(c1).not.toEqual(c2);
			});
		});
	});
});
