import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildActivityContext } from "./builder.js";

function createTestDir(): string {
	const dir = join(tmpdir(), `letra-activity-context-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(dir, ".letra", "specs"), { recursive: true });
	return dir;
}

function writeWorkflow(dir: string, overrides?: Record<string, unknown>) {
	const workflow = {
		version: "1.0",
		name: "letra-test",
		template: "test-flow",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "design", name: "Design", order: 1, zone: "doing" },
			{ id: "code", name: "Code", order: 2, zone: "doing" },
			{ id: "review", name: "Review", order: 3, zone: "doing" },
			{ id: "done", name: "Done", order: 4, zone: "done" },
		],
		items: [
			{
				id: "ITEM-47",
				description: "Activity Context core",
				stage: "design",
				createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				spec: "activity-context",
			},
		],
		tools: ["opencode"],
		...overrides,
	};
	writeFileSync(join(dir, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");
}

function writeHarness(dir: string) {
	const harnessRoot = join(dir, ".letra", "harness", "v0.1.0");
	mkdirSync(join(harnessRoot, "flows"), { recursive: true });
	mkdirSync(join(harnessRoot, "gates"), { recursive: true });
	mkdirSync(join(harnessRoot, "roles"), { recursive: true });
	writeFileSync(join(harnessRoot, "flows", "test-flow.yaml"), [
		"id: test-flow",
		"version: 1.0.0",
		"name: Test Flow",
		"description: Flow de teste",
		"defaultPolicy: policies/test.json",
		"stages:",
		"  - id: backlog",
		"    name: Backlog",
		"    order: 0",
		"    zone: todo",
		"    description: Backlog",
		"    agents: []",
		"    gate: null",
		"  - id: design",
		"    name: Design",
		"    order: 1",
		"    zone: doing",
		"    description: Design",
		"    agents: [\"analyst\"]",
		"    gate: null",
		"    activity:",
		"      design:",
		"        objective: Direção declarada pelo harness",
		"      diagnose:",
		"        objective: Diagnóstico declarado sem ocultar sinais",
		"      gate:",
		"        label: Aprovação de direção/spec",
		"        evidence: outcome, constraints, exclusions e decisões em aberto",
		"        decision: Aprovação de direção/spec",
		"        signalCode: spec-approval",
		"  - id: code",
		"    name: Code",
		"    order: 2",
		"    zone: doing",
		"    description: Code",
		"    agents: [\"builder\"]",
		"    gate: null",
		"  - id: review",
		"    name: Review",
		"    order: 3",
		"    zone: doing",
		"    description: Review",
		"    agents: [\"reviewer\"]",
		"    gate: gates/human-approved-review.yaml",
		"    activity:",
		"      gate:",
		"        label: Aprovação de revisão",
		"        evidence: issues abertas, aderência à spec, riscos e sinais operacionais",
		"        decision: Aprovação de revisão",
		"        signalCode: gate-review",
		"      review:",
		"        label: Revisão do item atual",
		"        emphasis: aderência à spec, riscos e evidências do trabalho entregue",
		"        riskFocus: Destacar bugs, regressões e violações de processo antes de aprovar.",
		"        evidencePrompt: Verificar se testes, sinais e logs recentes sustentam a revisão.",
		"        signalCode: review-stage",
		"    phases:",
		"      initialState: auto-review",
		"      states:",
		"        auto-review:",
		"          id: auto-review",
		"          label: Revisão automática",
		"          description: Agente revisa o diff",
		"          transitions:",
		"            - target: code-fix",
		"              auto: true",
		"            - target: human-review",
		"          harness:",
		"            instructions: Foque em bugs e regressões",
		"            activity:",
		"              review:",
		"                objective: Revisão da fase declarada",
		"            checks:",
		"              - diff contra spec",
		"              - testes passando",
		"              - code style",
		"            review:",
		"              label: Revisão automática",
		"              emphasis: diff contra spec, testes passando, code style",
		"              riskFocus: Confirmar se o diff introduziu bugs, regressões ou violações de processo.",
		"              evidencePrompt: Verificar se testes, sinais e logs recentes sustentam a revisão automática.",
		"              signalCode: review-phase-auto-review",
		"        code-fix:",
		"          id: code-fix",
		"          label: Correção",
		"          description: Corrigir problemas",
		"          transitions:",
		"            - target: human-review",
		"          harness:",
		"            review:",
		"              label: Correção",
		"              emphasis: corrigir os problemas encontrados antes de seguir",
		"              riskFocus: Confirmar se correções realmente eliminaram os problemas anteriores.",
		"              evidencePrompt: Verificar se a correção cobre os problemas anteriores com evidências claras.",
		"              signalCode: review-phase-code-fix",
		"        human-review:",
		"          id: human-review",
		"          label: Revisão humana",
		"          description: Aprovação humana final",
		"          transitions:",
		"            - target: __EXIT__",
		"          harness:",
		"            review:",
		"              label: RevisÃ£o humana",
		"              emphasis: aprovaÃ§Ã£o final humana baseada em evidÃªncias explÃ­citas",
		"              riskFocus: Destacar riscos residuais antes da aprovaÃ§Ã£o final humana.",
		"              evidencePrompt: Verificar se hÃ¡ evidÃªncias suficientes para aprovaÃ§Ã£o final humana.",
		"              signalCode: review-phase-human-review",
		"  - id: done",
		"    name: Done",
		"    order: 4",
		"    zone: done",
		"    description: Done",
		"    agents: []",
		"    gate: null",
	].join("\n"), "utf-8");
	writeFileSync(join(harnessRoot, "gates", "human-approved-review.yaml"), [
		"id: human-approved-review",
		"name: Aprovação de revisão",
		"type: human",
		"blocking: true",
		"description: issues abertas, aderência à spec, riscos e sinais operacionais",
	].join("\n"), "utf-8");
	writeFileSync(join(harnessRoot, "roles", "reviewer.yaml"), [
		"id: reviewer",
		"label: Reviewer",
		"description: Reviewer",
		"allowedStages: [\"review\"]",
		"capabilities: [\"review\"]",
	].join("\n"), "utf-8");
}

function writeSpec(dir: string, specName: string) {
	const specDir = join(dir, ".letra", "specs", specName);
	mkdirSync(specDir, { recursive: true });
	writeFileSync(join(specDir, "spec.md"), [
		`# Spec: ${specName}`,
		"",
		"## Outcome",
		"Entregar contexto situacional por atividade.",
		"",
		"## Acceptance Criteria",
		"- [ ] **AC1**: Builder existe",
		"- [x] **AC2**: Tipos definidos",
	].join("\n"), "utf-8");
}

function writeFocus(dir: string, specName: string, itemId: string, outcome = "Entregar contexto situacional por atividade.") {
	writeFileSync(join(dir, ".letra", "focus.md"), [
		`# Focus: ${specName}`,
		"",
		`**Path**: .letra/specs/${specName}/`,
		`**Item**: ${itemId}`,
		`**Outcome**: ${outcome}`,
	].join("\n"), "utf-8");
}

function writeHealth(dir: string, entries: Record<string, unknown>[]) {
	writeFileSync(join(dir, ".letra", "health-record.json"), JSON.stringify({
		schemaVersion: 1,
		lastScanAt: new Date().toISOString(),
		entries,
	}, null, 2), "utf-8");
}

describe("buildActivityContext", () => {
	let dir: string;

	beforeEach(() => {
		dir = createTestDir();
		writeFileSync(join(dir, ".letra", "context.md"), "# Context\n", "utf-8");
		writeFileSync(join(dir, ".letra", "constitution.md"), "# Constitution\n", "utf-8");
		writeHarness(dir);
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("builds context from focus and current item", () => {
		writeWorkflow(dir);
		writeSpec(dir, "activity-context");
		writeFocus(dir, "activity-context", "ITEM-47");

		const result = buildActivityContext({ activity: "implement", workspaceRoot: dir });

		expect(result.currentItem?.id).toBe("ITEM-47");
		expect(result.currentItem?.spec).toBe("activity-context");
		expect(result.currentItem?.acs).toEqual({ pending: 1, done: 1, total: 2 });
		expect(result.mustRead.map((entry) => entry.path)).toContain(".letra/focus.md");
		expect(result.mustRead.map((entry) => entry.path)).toContain(".letra/specs/activity-context/spec.md");
	});

	it("uses the explicitly focused item when multiple items are active", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-47",
					description: "Focused item",
					stage: "design",
					createdAt: "2026-07-01T00:00:00.000Z",
					spec: "activity-context",
				},
				{
					id: "ITEM-99",
					description: "Newer active item",
					stage: "review",
					createdAt: "2026-07-02T00:00:00.000Z",
					spec: "other-spec",
				},
			],
		});
		writeSpec(dir, "activity-context");
		writeFocus(dir, "activity-context", "ITEM-47");

		const result = buildActivityContext({ activity: "design", workspaceRoot: dir });

		expect(result.currentItem?.id).toBe("ITEM-47");
		expect(result.stage?.id).toBe("design");
		expect(result.signals.some((signal) => signal.code === "focus-diverged")).toBe(false);
	});

	it("falls back safely when there is no active item", () => {
		writeWorkflow(dir, { items: [] });

		const result = buildActivityContext({ activity: "design", workspaceRoot: dir });

		expect(result.currentItem).toBeNull();
		expect(result.signals.some((signal) => signal.code === "no-current-item")).toBe(true);
		expect(result.nextActions[0]?.label).toBe("Triar item");
	});

	it("emits divergence signal when focus and active item disagree", () => {
		writeWorkflow(dir);
		writeSpec(dir, "activity-context");
		writeSpec(dir, "other-spec");
		writeFocus(dir, "other-spec", "ITEM-47");

		const result = buildActivityContext({ activity: "review", workspaceRoot: dir });

		expect(result.signals.some((signal) => signal.code === "focus-diverged")).toBe(true);
	});

	it("surfaces active health alerts as signals and risks", () => {
		writeWorkflow(dir);
		writeSpec(dir, "activity-context");
		writeHealth(dir, [
			{
				id: "hr-1",
				type: "error",
				title: "Drift crítico",
				status: "novo",
				severity: "alta",
				source: "test",
				detectedAt: new Date().toISOString(),
				resolvedAt: null,
				dismissedAt: null,
				dismissReason: null,
				acknowledgedAt: null,
			},
		]);

		const result = buildActivityContext({ activity: "diagnose", workspaceRoot: dir });

		expect(result.objective).toBe("Diagnóstico declarado sem ocultar sinais");
		expect(result.signals.some((signal) => signal.code === "active-health-alerts")).toBe(true);
		expect(result.risks.some((risk) => risk.level === "high")).toBe(true);
		expect(result.mustRead.map((entry) => entry.path)).toContain(".letra/health-record.json");
	});

	it("specializes review mode around evidence and pending ACs", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-48",
					description: "Review item",
					stage: "review",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "review", workspaceRoot: dir });

		expect(result.nextActions.map((action) => action.label)).toContain("Cobrar evidências");
		expect(result.mustRead.map((entry) => entry.path)).toContain(".letra/session-log.json");
		expect(result.signals.some((signal) => signal.code === "pending-acceptance-criteria")).toBe(true);
	});

	it("specializes review mode for auto-review phase", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-48",
					description: "Review item",
					stage: "review",
					currentPhase: "auto-review",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "review", workspaceRoot: dir });

		expect(result.currentItem?.currentPhase).toBe("auto-review");
		expect(result.objective).toBe("Revisão da fase declarada");
		expect(result.signals.some((signal) => signal.code === "review-phase-auto-review")).toBe(true);
		expect(result.nextActions[0]?.label).toBe("Comparar com spec");
	});

	it("specializes review mode for code-fix phase", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-48",
					description: "Review item",
					stage: "review",
					currentPhase: "code-fix",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "review", workspaceRoot: dir });

		expect(result.signals.some((signal) => signal.code === "review-phase-code-fix")).toBe(true);
		expect(result.nextActions[1]?.label).toBe("Listar riscos");
	});

	it("specializes review mode for human-review phase", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-48",
					description: "Review item",
					stage: "review",
					currentPhase: "human-review",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "review", workspaceRoot: dir });

		expect(result.signals.some((signal) => signal.code === "review-phase-human-review")).toBe(true);
		expect(result.nextActions[2]?.label).toBe("Cobrar evidências");
	});

	it("specializes gate mode around human approval", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-49",
					description: "Gate item",
					stage: "review",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "gate", workspaceRoot: dir });

		expect(result.nextActions.map((action) => action.label)).toContain("Responder gate");
		expect(result.mustNotDo.some((item) => item.includes("decisão humana"))).toBe(true);
		expect(result.risks.some((risk) => risk.level === "high")).toBe(true);
		expect(result.signals.some((signal) => signal.code === "gate-review")).toBe(true);
		expect(result.nextActions.map((action) => action.label)).toContain("Preparar evidências");
	});

	it("uses a different gate expectation for design-stage items", () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-50",
					description: "Design gate item",
					stage: "design",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "gate", workspaceRoot: dir });

		expect(result.signals.some((signal) => signal.code === "spec-approval")).toBe(true);
		expect(result.nextActions.map((action) => action.label)).toContain("Responder gate");
	});

	it("derives expectations from flow metadata even with neutral stage ids", () => {
		writeWorkflow(dir, {
			stages: [
				{ id: "todo-box", name: "Todo", order: 0, zone: "todo" },
				{ id: "thinking-lane", name: "Thinking", order: 1, zone: "doing" },
				{ id: "qa-stop", name: "QA Stop", order: 2, zone: "doing" },
				{ id: "shipped", name: "Shipped", order: 3, zone: "done" },
			],
			items: [
				{
					id: "ITEM-51",
					description: "Metadata-driven review",
					stage: "qa-stop",
					currentPhase: "human-review",
					createdAt: new Date().toISOString(),
					spec: "activity-context",
				},
			],
		});

		const harnessRoot = join(dir, ".letra", "harness", "v0.1.0");
		writeFileSync(join(harnessRoot, "flows", "test-flow.yaml"), [
			"id: test-flow",
			"version: 1.0.0",
			"name: Test Flow",
			"description: Flow de teste",
			"defaultPolicy: policies/test.json",
			"stages:",
			"  - id: todo-box",
			"    name: Todo",
			"    order: 0",
			"    zone: todo",
			"    description: Todo",
			"    agents: []",
			"    gate: null",
			"  - id: thinking-lane",
			"    name: Thinking",
			"    order: 1",
			"    zone: doing",
			"    description: Thinking",
			"    agents: [\"analyst\"]",
			"    gate: null",
			"  - id: qa-stop",
			"    name: QA Stop",
			"    order: 2",
			"    zone: doing",
			"    description: QA Stop",
			"    agents: [\"reviewer\"]",
			"    gate: gates/human-approved-review.yaml",
			"    activity:",
			"      gate:",
			"        label: Aprovação de revisão",
			"        evidence: issues abertas, aderência à spec, riscos e sinais operacionais",
			"        decision: Aprovação de revisão",
			"        signalCode: gate-review",
			"    phases:",
			"      initialState: human-review",
			"      states:",
			"        human-review:",
			"          id: human-review",
			"          label: Revisão humana",
			"          description: Aprovação humana final",
			"          harness:",
			"            review:",
			"              label: Revisão humana",
			"              emphasis: aprovação final humana baseada em evidências explícitas",
			"              riskFocus: Destacar riscos residuais antes da aprovação final humana.",
			"              evidencePrompt: Verificar se há evidências suficientes para aprovação final humana.",
			"              signalCode: review-phase-human-review",
			"          transitions:",
			"            - target: __EXIT__",
			"  - id: shipped",
			"    name: Shipped",
			"    order: 3",
			"    zone: done",
			"    description: Shipped",
			"    agents: []",
			"    gate: null",
		].join("\n"), "utf-8");
		writeSpec(dir, "activity-context");

		const reviewContext = buildActivityContext({ activity: "review", workspaceRoot: dir });
		const gateContext = buildActivityContext({ activity: "gate", workspaceRoot: dir });

		expect(reviewContext.signals.some((signal) => signal.code === "review-phase-human-review")).toBe(true);
		expect(reviewContext.nextActions[2]?.label).toBe("Cobrar evidências");
		expect(gateContext.signals.some((signal) => signal.code === "gate-review")).toBe(true);
		expect(gateContext.nextActions.map((action) => action.label)).toContain("Responder gate");
	});

	it("specializes diagnose mode around health and impact prioritization", () => {
		writeWorkflow(dir);
		writeSpec(dir, "activity-context");
		writeHealth(dir, [
			{
				id: "hr-1",
				type: "warning",
				title: "Drift moderado",
				status: "novo",
				severity: "media",
				source: "test",
				detectedAt: new Date().toISOString(),
				resolvedAt: null,
				dismissedAt: null,
				dismissReason: null,
				acknowledgedAt: null,
			},
		]);

		const result = buildActivityContext({ activity: "diagnose", workspaceRoot: dir });

		expect(result.mustRead.map((entry) => entry.path)).toContain(".letra/health-record.json");
		expect(result.nextActions.map((action) => action.label)).toContain("Priorizar impacto");
		expect(result.signals.some((signal) => signal.code === "active-health-alerts")).toBe(true);
	});

	it("specializes design mode around decisions instead of execution", () => {
		writeWorkflow(dir);
		writeSpec(dir, "activity-context");

		const result = buildActivityContext({ activity: "design", workspaceRoot: dir });

		expect(result.objective).toBe("Direção declarada pelo harness");
		expect(result.nextActions.map((action) => action.label)).toContain("Preparar decisões");
		expect(result.mustNotDo.some((item) => item.includes("implementar código"))).toBe(true);
	});
});
