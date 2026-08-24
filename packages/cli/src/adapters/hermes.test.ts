import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHarnessSnapshot } from "./builder.js";
import { formatAdapterContent } from "./formatters.js";
import { generateAdapters } from "./generate.js";

describe("hermes adapter", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-hermes-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	it("generates .hermes/instructions.md when hermes in tools", () => {
		generateAdapters(tmpDir, ["hermes"], {
			source: "init",
			workflow: {
				name: "test",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
			},
			activeStageId: "code",
			primaryItemId: "ITEM-1",
			quiet: true,
		});

		const filePath = join(tmpDir, ".hermes", "instructions.md");
		expect(existsSync(filePath)).toBe(true);

		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("# Letra Session — test");
		expect(content).toContain("- .letra/context.md");
		expect(content).toContain("## Comandos");
	});

	it("creates .hermes/ directory automatically", () => {
		generateAdapters(tmpDir, ["hermes"], {
			source: "flow-move",
			workflow: {
				name: "test",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
			},
			activeStageId: "code",
			primaryItemId: "ITEM-1",
			quiet: true,
		});

		expect(existsSync(join(tmpDir, ".hermes"))).toBe(true);
		expect(existsSync(join(tmpDir, ".hermes", "instructions.md"))).toBe(true);
	});

	it("includes header Gerado por letra flow move", () => {
		generateAdapters(tmpDir, ["hermes"], {
			source: "flow-move",
			quiet: true,
		});

		const content = readFileSync(join(tmpDir, ".hermes", "instructions.md"), "utf-8");
		expect(content).toContain("Gerado por letra flow move. Nao edite manualmente.");
	});

	it("includes focus section when focus.md exists", () => {
		writeFileSync(join(tmpDir, ".letra", "focus.md"), "# Focus: test\n");
		generateAdapters(tmpDir, ["hermes"], {
			source: "flow-move",
			workflow: {
				name: "test",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
			},
			activeStageId: "code",
			primaryItemId: "ITEM-1",
			quiet: true,
		});

		const content = readFileSync(join(tmpDir, ".hermes", "instructions.md"), "utf-8");
		expect(content).toContain(".letra/focus.md");
	});

	it("includes alerts section when health-record has alerts", () => {
		writeFileSync(
			join(tmpDir, ".letra", "health-record.json"),
			JSON.stringify({
				version: 1,
				entries: [
					{
						id: "hr-test-001",
						severity: "baixa",
						status: "novo",
						title: "Test alert",
						source: "test-detector",
						detectedAt: new Date().toISOString(),
					},
				],
			}),
		);

		generateAdapters(tmpDir, ["hermes"], {
			source: "flow-move",
			workflow: {
				name: "test",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
			},
			activeStageId: "code",
			primaryItemId: "ITEM-1",
			quiet: true,
		});

		const content = readFileSync(join(tmpDir, ".hermes", "instructions.md"), "utf-8");
		expect(content).toContain("Test alert");
		expect(content).toContain("hr-test-001");
	});

	it("regenerates on source=flow-move with correct header", () => {
		generateAdapters(tmpDir, ["hermes"], {
			source: "flow-move",
			quiet: true,
		});

		const content = readFileSync(join(tmpDir, ".hermes", "instructions.md"), "utf-8");
		expect(content).toContain("flow move");
	});

	it("buildHarnessSnapshot works alongside hermes", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, {
			source: "init",
		});
		expect(snapshot.hasWorkflow).toBe(false);
		expect(snapshot.items).toEqual([]);
	});

	it("formatAdapterContent produces Hermes-compatible text format", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, {
			source: "flow-move",
			workflow: {
				name: "test",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task A", stage: "code" }],
			},
			activeStageId: "code",
			primaryItemId: "ITEM-1",
		});

		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-move",
			displayName: "Hermes Agent",
		});

		expect(content).toContain("# Letra Session — test");
		expect(content).toContain("- .letra/context.md");
		expect(content).toContain("## Comandos");
		expect(content).toContain("## Regras");
		expect(content).toContain("## Fluxo de Execução");
		expect(content).toContain("## Checklist de Encerramento");
	});
});
