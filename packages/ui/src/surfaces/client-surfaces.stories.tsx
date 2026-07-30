import { useEffect, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ResolvedFlowDefinition, ResolvedSpec, Workflow } from "@letra/types";
import { ToastProvider } from "@letra/ui";

import HomeView from "../../../client/src/components/Home/HomeView";
import FlowView from "../../../client/src/components/Flow/FlowView";
import ExecutionView, { type ExecStage } from "../../../client/src/components/Execution/ExecutionView";
import ContextView from "../../../client/src/components/Context/ContextView";
import SpecsView from "../../../client/src/components/Specs/SpecsView";
import WorkspacesView from "../../../client/src/components/Workspaces/WorkspacesView";

import "../../../client/src/index.css";

const now = "2026-07-11T12:00:00.000Z";

const workflow: Workflow = {
	version: "1",
	name: "Letra Release",
	description: "Workspace supervision flow",
	language: "pt-BR",
	template: "sdlc",
	harnessVersion: "v0.1.3",
	createdAt: "2026-07-01T09:00:00.000Z",
	updatedAt: now,
	tools: ["codex", "opencode"],
	primaryItemId: "ITEM-76",
	specLinks: {
		"ds-catalog": { path: ".letra/specs/ds-catalog/spec.md" },
		"ux-release-readiness": { path: ".letra/specs/ux-release-readiness/spec.md" },
	},
	stages: [
		{ id: "backlog", name: "Backlog", order: 0, zone: "todo", allow: ["code"] },
		{ id: "code", name: "Code", order: 1, zone: "doing", allow: ["review"], validate: ["npm run build", "letra validate"] },
		{ id: "review", name: "Review", order: 2, zone: "doing", allow: ["security"] },
		{ id: "security", name: "Security", order: 3, zone: "doing", allow: ["done"] },
		{ id: "done", name: "Done", order: 4, zone: "done" },
	],
	items: [
		{
			id: "ITEM-76",
			description: "Catalogo visual do DS v2 em Storybook 8",
			stage: "code",
			createdAt: "2026-07-10T12:00:00.000Z",
			spec: "ds-catalog",
			claimedBy: "codex",
			claimedAt: now,
			tasks: [
				{ id: "AC5", description: "Patterns completos", done: true },
				{ id: "AC6", description: "Superficies do client catalogadas", done: false },
				{ id: "AC7", description: "CI do catalogo", done: true },
			],
		},
		{
			id: "ITEM-75",
			description: "Convergir superficies criticas da release",
			stage: "review",
			createdAt: "2026-07-08T09:00:00.000Z",
			spec: "ux-release-readiness",
			claimedBy: "opencode",
			tasks: [
				{ id: "review", description: "Validar regressao visual", done: false },
			],
		},
		{
			id: "ITEM-63",
			description: "Direcao de agentes por harness",
			stage: "security",
			createdAt: "2026-07-05T09:00:00.000Z",
			spec: "harness-agent-direction",
		},
		{
			id: "ITEM-29",
			description: "Central de diagnosticos e alertas de saude",
			stage: "backlog",
			createdAt: "2026-07-03T09:00:00.000Z",
			spec: "diagnostics-hub",
		},
		{
			id: "ITEM-68",
			description: "Tokens semanticos do DS v2",
			stage: "done",
			createdAt: "2026-06-28T09:00:00.000Z",
			spec: "design-system-v2",
		},
	],
	webhooks: [
		{ id: "ci", label: "Catalog CI", url: "https://example.invalid/ci", events: ["item.moved"], lastStatus: "ok", lastSentAt: now },
	],
};

const activeFlow: ResolvedFlowDefinition = {
	id: "sdlc",
	source: "workflow-template",
	harnessVersion: "v0.1.3",
	templateVersion: "2026-07",
	name: "Letra SDLC",
	roles: [
		{ id: "builder", label: "Builder", description: "Implementa ACs", allowedStages: ["code"], capabilities: ["code", "test"] },
		{ id: "reviewer", label: "Reviewer", description: "Revisa riscos", allowedStages: ["review"], capabilities: ["review"] },
		{ id: "security", label: "Security", description: "Valida riscos", allowedStages: ["security"], capabilities: ["security"] },
	],
	warnings: [],
	stages: workflow.stages.map((stage) => ({
		id: stage.id,
		name: stage.name,
		order: stage.order,
		zone: stage.zone,
		description: stage.id === "code" ? "Implementacao orientada por ACs" : undefined,
		roleIds: stage.id === "code" ? ["builder"] : stage.id === "review" ? ["reviewer"] : stage.id === "security" ? ["security"] : [],
		roles: stage.id === "code"
			? [{ id: "builder", label: "Builder", description: "Implementa ACs", allowedStages: ["code"], capabilities: ["code", "test"] }]
			: stage.id === "review"
				? [{ id: "reviewer", label: "Reviewer", description: "Revisa riscos", allowedStages: ["review"], capabilities: ["review"] }]
				: stage.id === "security"
					? [{ id: "security", label: "Security", description: "Valida riscos", allowedStages: ["security"], capabilities: ["security"] }]
					: [],
		agents: [],
		gate: stage.id === "review" || stage.id === "security"
			? {
				id: `${stage.id}-gate`,
				name: stage.name,
				type: "human",
				blocking: true,
				description: "Aguardando decisao humana antes de seguir",
			}
			: null,
		provenance: "harness",
	})),
};

const specs: ResolvedSpec[] = [
	{
		id: "ds-catalog",
		content: `# Spec: DS Visual Catalog

> Updated: 2026-07-11

## Outcome

@letra/ui e fonte unica da verdade visual para humanos e agentes.

## Constraints

- Storybook 8 deve renderizar tokens, primitivas, patterns e superficies reais.

## Exclusions

- Refactor visual das superficies do client.

## Acceptance Criteria

- [x] **AC5**: Patterns completos.
- [ ] **AC6**: Superficies do client catalogadas.
- [x] **AC7**: CI do catalogo.

## Context

O catalogo reduz drift entre DS, Storybook e produto.`,
	},
	{
		id: "ux-release-readiness",
		content: `# Spec: UX Release Readiness

> Updated: 2026-07-10

## Outcome

Superficies criticas convergem para supervisao de agentes.

## Acceptance Criteria

- [ ] Home rica.
- [ ] Fluxo supervisionavel.`,
	},
];

const executionStages: ExecStage[] = [
	{ id: "backlog", label: "Backlog", agent: "Planner", agentIcon: "list-three", status: "done", duration: "1m" },
	{ id: "code", label: "Code", agent: "Codex", agentIcon: "cpu", status: "running", output: "Storybook surfaces mounted with DS mocks." },
	{ id: "review", label: "Review", agent: "Reviewer", agentIcon: "search", status: "waiting", isHumanGate: true, nextStageId: "security", rejectStageId: "code" },
	{ id: "security", label: "Security", agent: "Security", agentIcon: "shield", status: "idle" },
	{ id: "done", label: "Done", agent: "Letra", agentIcon: "check-circle", status: "idle" },
];

const markdownContext = `# Context

## Estado

ITEM-76 esta em Code com AC6 em andamento.

## Produto

Letra e uma interface de supervisao para times de agentes autonomos.`;

const decisions = [
	{ name: "2026-07-03-regression-safety-before-expansion.md", content: "# Regression safety before expansion\n\n## Escolha\n\nValidar surfaces antes de expandir o catalogo." },
	{ name: "2026-07-03-product-truth-and-supervision-navigation.md", content: "# Product truth and supervision navigation\n\n## Escolha\n\nPriorizar supervisao e evidencias." },
];

const workspaces = [
	{
		id: "letra",
		name: "Letra",
		description: "Workspace principal do produto",
		slug: "letra",
		root: "C:/Workspace/letra",
		createdAt: "2026-06-17T12:00:00.000Z",
		directories: ["C:/Workspace/letra/packages/client", "C:/Workspace/letra/packages/ui"],
		tools: ["codex", "opencode"],
		template: "sdlc",
	},
	{
		id: "playground",
		name: "DS Playground",
		description: "Validacao visual isolada",
		slug: "ds-playground",
		root: "C:/Workspace/letra/design-system",
		createdAt: "2026-07-01T12:00:00.000Z",
		directories: ["C:/Workspace/letra/design-system"],
		tools: ["storybook"],
		template: "design-system",
	},
];

function jsonResponse(data: unknown) {
	return new Response(JSON.stringify(data), {
		headers: { "content-type": "application/json" },
	});
}

function textResponse(data: string) {
	return new Response(data, {
		headers: { "content-type": "text/plain" },
	});
}

function createMockFetch() {
	return async (input: RequestInfo | URL) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		const path = new URL(url, "http://storybook.local").pathname;
		const query = new URL(url, "http://storybook.local").searchParams;

		if (path === "/api/focus") return jsonResponse({ active: true, spec: "ds-catalog" });
		if (path === "/api/health") {
			return jsonResponse({
				active: [
					{ id: "hr-63", title: "Spec link ausente em ITEM-63", source: "health", severity: "low" },
					{ id: "hr-ds", title: "AC6 em catalogacao", source: "ds-catalog", severity: "medium" },
				],
			});
		}
		if (path === "/api/log") {
			return jsonResponse({
				entries: [
					{ id: "log-1", timestamp: now, action: "storybook:build", description: "Catalogo visual validado", itemId: "ITEM-76" },
					{ id: "log-2", timestamp: "2026-07-11T11:30:00.000Z", action: "letra validate", description: "0 falhas, avisos globais", itemId: "ITEM-76" },
				],
			});
		}
		if (path === "/api/specs") return jsonResponse(specs);
		if (path.startsWith("/api/specs/") && path.endsWith("/validate")) {
			return jsonResponse({ id: path.split("/")[3], valid: true, issues: [] });
		}
		if (path.startsWith("/api/specs/")) {
			const id = path.split("/")[3];
			return jsonResponse(specs.find((spec) => spec.id === id) ?? specs[0]);
		}
		if (path === "/api/context") {
			const file = query.get("file");
			if (file === "decisions") return jsonResponse(decisions);
			if (file === "constitution.md") return textResponse("# Constitution\n\n## Regras\n\nSpecs antes de codigo.");
			if (file === "glossary.md") return textResponse("# Glossary\n\n## Agent\n\nExecutor supervisionado.");
			return textResponse(markdownContext);
		}
		if (path === "/api/harness") {
			return jsonResponse({
				layers: {
					l1: [{ path: ".letra/context.md", content: markdownContext }],
					l2: { focus: { specName: "ds-catalog", content: "# Focus: ds-catalog" }, spec: { path: ".letra/specs/ds-catalog/spec.md", content: specs[0].content } },
					l3: { alerts: [{ id: "hr-ds", severity: "baixa", message: "AC6 em catalogacao" }], alertCount: 1, sessionEventCount: 4 },
					l4: { constraintsContent: "# Constraints\n\nUse @letra/ui.", glossaryContent: "# Glossary\n\nDS: Design System." },
				},
			});
		}
		if (path === "/api/workspaces") return jsonResponse(workspaces);
		if (path.startsWith("/api/items") || path === "/api/workflow") return jsonResponse({ ok: true });

		return jsonResponse({});
	};
}

let previousFetch: typeof fetch | undefined;
let mockFetchInstalled = false;

function installMockFetch() {
	if (mockFetchInstalled) return;
	previousFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch() as typeof fetch;
	mockFetchInstalled = true;
}

function restoreMockFetch() {
	if (!mockFetchInstalled || !previousFetch) return;
	globalThis.fetch = previousFetch;
	previousFetch = undefined;
	mockFetchInstalled = false;
}

function SurfaceFrame({ children }: { children: ReactNode }) {
	installMockFetch();

	useEffect(() => {
		return restoreMockFetch;
	}, []);

	return (
		<ToastProvider>
			<div className="app-surface-base flex h-[820px] min-h-0 w-full overflow-hidden rounded-[var(--radius-sm)] border border-border">
				{children}
			</div>
		</ToastProvider>
	);
}

export default {
	title: "Surfaces/ClientViews",
	parameters: {
		layout: "fullscreen",
		"x-ds": {
			category: "surface",
			status: "ready",
			tokens: ["color-bg-base", "color-bg-surface", "color-text-primary", "color-primary", "border", "radius-lg"],
			consumes: ["Button", "Card", "Badge", "Icon", "Input", "Sheet", "ToastProvider"],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["mocked-api", "keyboard-navigation", "landmarks"],
			breakpoints: ["mobile", "desktop"],
		},
	},
} satisfies Meta;

type Story = StoryObj;

export const Home: Story = {
	render: () => (
		<SurfaceFrame>
			<HomeView workflow={workflow} activeFlow={activeFlow} onTabChange={() => {}} />
		</SurfaceFrame>
	),
};

export const Flow: Story = {
	render: () => (
		<SurfaceFrame>
			<FlowView workflow={workflow} activeFlow={activeFlow} onItemMoved={() => {}} onOpenSpec={() => {}} />
		</SurfaceFrame>
	),
};

export const Execution: Story = {
	render: () => (
		<SurfaceFrame>
			<ExecutionView stages={executionStages} workflow={workflow} flowName="Letra SDLC" />
		</SurfaceFrame>
	),
};

export const Context: Story = {
	render: () => (
		<SurfaceFrame>
			<ContextView initialTab="context.md" />
		</SurfaceFrame>
	),
};

export const Specs: Story = {
	render: () => (
		<SurfaceFrame>
			<SpecsView />
		</SurfaceFrame>
	),
};

export const Workspaces: Story = {
	render: () => (
		<SurfaceFrame>
			<WorkspacesView activeSlug="letra" activeDirectory="C:/Workspace/letra/packages/ui" />
		</SurfaceFrame>
	),
};
