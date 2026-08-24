import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHarnessSnapshot } from "./builder.js";
import { formatAdapterContent } from "./formatters.js";
import type { GenerateOptions } from "./types.js";

describe("harness-direction", () => {
	let tmpDir: string;
	const harnessDir = ".letra/harness/v0.1.3";
	const flowYaml = `
id: flow-main
version: "0.1.3"
name: Test Flow
stages:
  - id: design
    name: Design
    order: 0
    zone: doing
    agents: ["analyst"]
    activity:
      design:
        objective: "Definir solucao."
        commands:
          - command: "letra validate"
            label: "Validar"
        mustNotDo: ["Nao implementar antes de aprovar."]
        nextActions:
          - label: "Consolidar desenho"
      gate:
        objective: "Preparar aprovacao humana."
        nextActions:
          - label: "Preparar evidencias"
  - id: code
    name: Code
    order: 1
    zone: doing
    agents: ["builder"]
    activity:
      implement:
        objective: "Implementar conforme a spec."
        commands:
          - command: "letra ac done <AC-ID>"
            label: "Registrar AC"
          - command: "npm test"
            label: "Testar"
        mustNotDo: ["Nao ampliar escopo."]
        nextActions:
          - label: "Executar proximo AC"
            description: "Proximo criterio"
          - label: "Verificar drift"
            description: "Comparar com spec"
  - id: review
    name: Review
    order: 1
    zone: doing
    agents: ["reviewer"]
    activity:
      review:
        objective: "Revisar o trabalho."
        commands:
          - command: "letra flow move <ITEM-ID> --to done"
            label: "Mover para done"
        mustNotDo: ["Nao aprovar sem testes."]
        nextActions:
          - label: "Revisar diff"
  - id: empty-stage
    name: Empty
    order: 2
    zone: doing
    agents: ["agent"]
`;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-harness-dir-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
		mkdirSync(join(tmpDir, harnessDir, "flows"), { recursive: true });
		mkdirSync(join(tmpDir, harnessDir, "gates"), { recursive: true });
		mkdirSync(join(tmpDir, harnessDir, "roles"), { recursive: true });
		writeFileSync(join(tmpDir, harnessDir, "flows", "flow-main.yaml"), flowYaml);
		writeFileSync(
			join(tmpDir, ".letra", "workflow.json"),
			JSON.stringify({
				name: "Test",
				harnessVersion: "v0.1.3",
				template: "flow-main",
				stages: [
					{ id: "design", name: "Design", order: 0 },
					{ id: "code", name: "Code", order: 1 },
					{ id: "review", name: "Review", order: 2 },
					{ id: "empty-stage", name: "Empty", order: 3 },
				],
				items: [
					{ id: "ITEM-1", description: "Test Item", stage: "code", spec: "test-spec" },
				],
			}),
		);
		writeFileSync(join(tmpDir, ".letra", "context.md"), "# Context");
		writeFileSync(join(tmpDir, ".letra", "constitution.md"), "# Constitution");
		writeFileSync(join(tmpDir, ".letra", "glossary.md"), "# Glossary");
		writeFileSync(join(tmpDir, ".letra", "constraints.md"), "# Constraints");
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	const buildOptions = (overrides: Partial<GenerateOptions> = {}): GenerateOptions => ({
		source: "flow-ac",
		workflow: {
			name: "Test",
			stages: [
				{ id: "design", name: "Design", order: 0 },
				{ id: "code", name: "Code", order: 1 },
				{ id: "review", name: "Review", order: 2 },
				{ id: "empty-stage", name: "Empty", order: 3 },
			],
			items: [{ id: "ITEM-1", description: "Test Item", stage: "code", spec: "test-spec" }],
		},
		activeStageId: "code",
		primaryItemId: "ITEM-1",
		...overrides,
	});

	it("includes Direcao do Harness section in text format", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("## Direção do Harness");
		expect(content).toContain("**Versão**: v0.1.3");
		expect(content).toContain("**Papel**: builder");
		expect(content).toContain("**Estágios**: code");
		expect(content).toContain("**Item**: ITEM-1");
		expect(content).toContain("**Objetivo**: Implementar conforme a spec.");
		expect(content).toContain("**Comandos**:");
		expect(content).toContain("**Proibições**");
		expect(content).toContain("**Próximas ações**:");
	});

	it("includes section in @ format for Cursor/Windsurf", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "at", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("## Direção do Harness");
		expect(content).toContain("@harness: v0.1.3");
		expect(content).toContain("papel: builder");
		expect(content).toContain("estágios: code");
		expect(content).toContain("@comandos:");
	});

	it("omits section when there is no workflow", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, { source: "init" });
		const content = formatAdapterContent(snapshot, "text", {
			source: "init",
			displayName: "Test",
		});
		expect(content).not.toContain("## Direção do Harness");
		expect(content).not.toContain("harness-direction:start");
	});

	it("shows fallback when no item is active", () => {
		const snapshot = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				primaryItemId: undefined,
				workflow: {
					name: "Test",
					stages: [{ id: "code", name: "Code", order: 0 }],
					items: [],
				},
			}),
		);
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("Nenhum item em andamento");
	});

	it("shows note when stage has no activity configured", () => {
		const snapshot = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "empty-stage",
				primaryItemId: undefined,
				workflow: {
					name: "Test",
					stages: [{ id: "empty-stage", name: "Empty", order: 0 }],
					items: [
						{ id: "ITEM-2", description: "No Activity Item", stage: "empty-stage" },
					],
				},
			}),
		);
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("Estágio sem activity configurada no harness.");
	});

	it("has delimiters harness-direction:start and harness-direction:end", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("<!-- harness-direction:start -->");
		expect(content).toContain("<!-- harness-direction:end -->");
	});

	it("has @-format delimiters for Cursor/Windsurf", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "at", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("# harness-direction:start");
		expect(content).toContain("# harness-direction:end");
	});

	it("resolves <AC-ID> when pending ACs exist", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [ ] **AC10**: First AC\n- [ ] **AC11**: Second AC\n- [x] **AC12**: Done AC\n",
		);
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("- `letra ac done AC10`");
		expect(content).toContain("- `letra ac done AC11`");
		expect(content).not.toContain("- `letra ac done AC12`");
	});

	it("resolves <ITEM-ID> in commands", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [x] **AC1**: Done\n",
		);
		const snapshot = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "review",
				primaryItemId: "ITEM-1",
				workflow: {
					name: "Test",
					stages: [
						{ id: "code", name: "Code", order: 0 },
						{ id: "review", name: "Review", order: 1 },
						{ id: "empty-stage", name: "Empty", order: 2 },
					],
					items: [
						{
							id: "ITEM-1",
							description: "Test Item",
							stage: "review",
							spec: "test-spec",
						},
					],
				},
			}),
		);
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("letra flow move ITEM-1 --to done");
	});

	it("omits <AC-ID> command when no pending ACs exist", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [x] **AC1**: Done AC\n",
		);
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		const dirSection = content.substring(
			content.indexOf("harness-direction:start"),
			content.indexOf("harness-direction:end"),
		);
		expect(dirSection).not.toContain("letra ac done");
	});

	it("shows gate sub-section when gate activity has unique objective", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [x] **AC1**: Done\n",
		);
		const snapshot = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "design",
				workflow: {
					name: "Test",
					stages: [
						{ id: "design", name: "Design", order: 0 },
						{ id: "code", name: "Code", order: 1 },
					],
					items: [
						{
							id: "ITEM-1",
							description: "Test Item",
							stage: "design",
							spec: "test-spec",
						},
					],
				},
			}),
		);
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("**Gate**");
		expect(content).toContain("Preparar aprovacao humana");
	});

	it("hides gate sub-section when gate has no unique data vs work activities", () => {
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		const dirSection = content.includes("harness-direction:start")
			? content.substring(
					content.indexOf("harness-direction:start"),
					content.indexOf("harness-direction:end"),
				)
			: "";
		// code stage has no gate activity in flow-main.yaml
		expect(dirSection).not.toContain("**Gate**");
	});

	it("resolves ITEM-ID fallback to items[0] when primaryItemId is null", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [x] **AC1**: Done\n",
		);
		const snapshot = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "review",
				primaryItemId: undefined,
				workflow: {
					name: "Test",
					stages: [
						{ id: "code", name: "Code", order: 0 },
						{ id: "review", name: "Review", order: 1 },
					],
					items: [
						{
							id: "ITEM-FALLBACK",
							description: "Fallback Item",
							stage: "review",
							spec: "test-spec",
						},
					],
				},
			}),
		);
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(content).toContain("ITEM-FALLBACK");
	});

	it("produces valid harness-direction for all adapter sources", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [ ] **AC1**: Pending AC\n",
		);
		const adapters: Array<{ source: string; displayName: string }> = [
			{ source: "opencode", displayName: "OpenCode Agent" },
			{ source: "cursor", displayName: "Cursor Agent" },
			{ source: "claude-code", displayName: "Claude Code Agent" },
			{ source: "windsurf", displayName: "Windsurf Agent" },
			{ source: "vscode-copilot", displayName: "VSCode Copilot Agent" },
			{ source: "hermes", displayName: "Hermes Agent" },
		];
		for (const adapter of adapters) {
			const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
			const content = formatAdapterContent(snapshot, "text", {
				source: adapter.source as any,
				displayName: adapter.displayName,
			});
			expect(content).toContain("## Direção do Harness");
			expect(content).toContain("harness-direction:start");
			expect(content).toContain("harness-direction:end");
		}
	});

	it("updates direction when item moves to a different stage", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [ ] **AC1**: First\n- [x] **AC2**: Done\n",
		);

		// Stage: code — role is builder
		const snapshotCode = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "code",
				primaryItemId: "ITEM-1",
				workflow: {
					name: "Test",
					stages: [
						{ id: "code", name: "Code", order: 0 },
						{ id: "review", name: "Review", order: 1 },
					],
					items: [
						{
							id: "ITEM-1",
							description: "Test Item",
							stage: "code",
							spec: "test-spec",
						},
					],
				},
			}),
		);
		const contentCode = formatAdapterContent(snapshotCode, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(contentCode).toContain("**Papel**: builder");
		expect(contentCode).toContain("**Estágios**: code");

		// Stage: review — role is reviewer, commands change
		const snapshotReview = buildHarnessSnapshot(
			tmpDir,
			buildOptions({
				activeStageId: "review",
				primaryItemId: "ITEM-1",
				workflow: {
					name: "Test",
					stages: [
						{ id: "code", name: "Code", order: 0 },
						{ id: "review", name: "Review", order: 1 },
					],
					items: [
						{
							id: "ITEM-1",
							description: "Test Item",
							stage: "review",
							spec: "test-spec",
						},
					],
				},
			}),
		);
		const contentReview = formatAdapterContent(snapshotReview, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		expect(contentReview).toContain("**Papel**: reviewer");
		expect(contentReview).toContain("**Estágios**: review");
		expect(contentReview).toContain("**Objetivo**: Revisar o trabalho.");
	});

	it("resolves <AC-ID> to one line per pending AC", () => {
		const specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec\n## Acceptance Criteria\n- [ ] **AC10**: First\n- [ ] **AC11**: Second\n- [ ] **AC12**: Third\n",
		);
		const snapshot = buildHarnessSnapshot(tmpDir, buildOptions());
		const content = formatAdapterContent(snapshot, "text", {
			source: "flow-ac",
			displayName: "Test",
		});
		const dirSection = content.includes("harness-direction:start")
			? content.substring(
					content.indexOf("harness-direction:start"),
					content.indexOf("harness-direction:end"),
				)
			: "";
		const acLines = dirSection.match(/letra ac done AC\d+/g) || [];
		expect(acLines).toHaveLength(3);
		expect(acLines[0]).toBe("letra ac done AC10");
		expect(acLines[1]).toBe("letra ac done AC11");
		expect(acLines[2]).toBe("letra ac done AC12");
	});
});
