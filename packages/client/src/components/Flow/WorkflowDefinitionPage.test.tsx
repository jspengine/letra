import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowDefinitionPage from "./WorkflowDefinitionPage";

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("WorkflowDefinitionPage", () => {
	it("shows an honest empty state when no versioned definition exists", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		expect(await screen.findByRole("heading", { name: "Nenhuma definição versionada" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();
	});

	it("starts an editable draft from a template preview and saves only to the draft", async () => {
		const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "base", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH") return jsonResponse({ number: null, revision: 2, content: JSON.parse(options.body as string).content });
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { template: "base" } });
			if (url === "/api/workflow") return jsonResponse({ template: "base" });
			if (url === "/api/workflow/active-flow") return jsonResponse({ name: "Main Flow", stages: [{ id: "backlog", name: "Backlog", zone: "todo", order: 0 }, { id: "done", name: "Done", zone: "done", order: 1 }] });
			return new Response(null, { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		expect(await screen.findByText(/Rascunho baseado no template/)).toBeTruthy();
		expect(await screen.findByText(/preserva conexões, gates e regras/i)).toBeTruthy();
		await user.click(await screen.findByRole("button", { name: "Usar estágios como ponto de partida" }));
		expect(within(screen.getByRole("region", { name: "Mapa do fluxo" })).getByRole("button", { name: /Backlog/ })).toBeTruthy();
		await user.clear(screen.getByRole("textbox", { name: "Nome do estágio" }));
		await user.type(screen.getByRole("textbox", { name: "Nome do estágio" }), "Entrada");
		await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
		await waitFor(() => expect(screen.getByText("Rascunho · revisão 2 · Sem versão publicada")).toBeTruthy());
		const save = fetchMock.mock.calls.find(([url, options]) => url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH");
		expect(save).toBeTruthy();
		expect(JSON.parse(save?.[1]?.body as string)).toMatchObject({ expectedRevision: 1, content: { initialStageId: "backlog", stages: [{ id: "backlog", name: "Entrada" }, { id: "done" }] } });
		expect(JSON.parse(save?.[1]?.body as string).actor).toBeUndefined();
		expect(screen.getByRole("button", { name: "Rascunho" })).toBeTruthy();
	});

	it("shows a different active flow as read-only reference without treating it as the draft template", async () => {
		vi.stubGlobal("fetch", vi.fn(async (url: string) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "base", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { template: "base" } });
			if (url === "/api/workflow") return jsonResponse({ template: "flow-main" });
			if (url === "/api/workflow/active-flow") return jsonResponse({ name: "Main Flow", stages: [{ id: "backlog", name: "Backlog", zone: "todo", order: 0 }, { id: "code", name: "Code", zone: "doing", order: 1, gate: { id: "code-reviewed", type: "automated" } }] });
			return new Response(null, { status: 404 });
		}));
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		expect(await screen.findByText(/Referência do fluxo operacional atual; é diferente do template/)).toBeTruthy();
		expect(within(screen.getByRole("region", { name: "Mapa do fluxo" })).getByRole("button", { name: "Backlog" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Usar estágios como ponto de partida" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Nome do estágio" })).toBeNull();
	});

	it("lets the user inspect draft and published stages with the keyboard", async () => {
		const fetchMock = vi.fn(async (url: string) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Main Flow", activeVersionId: "v8", draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 3, content: { name: "Main Flow", initialStageId: "backlog", stages: [{ id: "backlog", name: "Backlog", transitions: [{ target: "design" }] }, { id: "design", name: "Design", zone: "work" }] } });
			if (url === "/api/workflow-definitions/main/active") return jsonResponse({ number: 8, revision: 1, content: { name: "Main Flow", initialStageId: "backlog", stages: [{ id: "backlog", name: "Backlog", final: true }] } });
			throw new Error(`Unexpected URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		const onBack = vi.fn();
		render(<WorkflowDefinitionPage onBack={onBack} />);

		expect(await screen.findByText("Rascunho · revisão 3 · Publicada v8")).toBeTruthy();
		const map = screen.getByRole("region", { name: "Mapa do fluxo" });
		const design = within(map).getByRole("button", { name: /^Design/ });
		design.focus();
		await user.keyboard("{Enter}");
		expect(design.getAttribute("aria-pressed")).toBe("true");
		expect((screen.getByRole("textbox", { name: "Zona" }) as HTMLInputElement).value).toBe("work");

		await user.click(screen.getByRole("button", { name: "Publicada v8" }));
		await waitFor(() => expect(within(map).queryByRole("button", { name: /^Design/ })).toBeNull());
		expect(screen.getByRole("button", { name: "Publicada v8" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.queryByRole("button", { name: "Salvar rascunho" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Voltar às configurações" }));
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("keeps unsaved edits when the draft revision conflicts", async () => {
		vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Flow", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH") return jsonResponse({ error: "DRAFT_REVISION_CONFLICT:2" }, 409);
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { name: "Flow", initialStageId: "start", stages: [{ id: "start", name: "Start", final: true }] } });
			return new Response(null, { status: 404 });
		}));
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		await screen.findByRole("textbox", { name: "Nome do estágio" });
		await user.clear(screen.getByRole("textbox", { name: "Nome do estágio" }));
		await user.type(screen.getByRole("textbox", { name: "Nome do estágio" }), "Entrada");
		await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
		expect((await screen.findByRole("alert")).textContent).toContain("mudou em outra sessão");
		expect((screen.getByRole("textbox", { name: "Nome do estágio" }) as HTMLInputElement).value).toBe("Entrada");
		expect(screen.getByRole("button", { name: "Descartar alterações e atualizar" })).toBeTruthy();
	});

	it("validates the saved revision before publishing with a reason and shows version history", async () => {
		const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Flow", activeVersionId: "v1", draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 2, content: { name: "Flow", initialStageId: "start", stages: [{ id: "start", name: "Start", transitions: [{ target: "done" }] }, { id: "done", name: "Done", final: true }] } });
			if (url === "/api/workflow-definitions/main/active") return jsonResponse({ number: 1, revision: 1, content: { name: "Flow", stages: [] } });
			if (url === "/api/workflow-definitions/main/versions") return jsonResponse([{ number: 1, revision: 1, publishedBy: "human:test", publishedAt: "2026-09-20T12:00:00.000Z", content: { name: "Flow", stages: [] } }]);
			if (url === "/api/workflow-definitions/main/validate") return jsonResponse({ valid: true, errors: [] });
			if (url === "/api/workflow-definitions/main/publish" && options?.method === "POST") return jsonResponse({ number: 2 }, 201);
			throw new Error(`Unexpected URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		const publish = await screen.findByRole("button", { name: "Publicar" });
		expect((publish as HTMLButtonElement).disabled).toBe(true);
		await user.click(screen.getByRole("button", { name: "Histórico" }));
		expect(await screen.findByText("Versão 1")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Close dialog" }));
		await user.click(screen.getByRole("button", { name: "Validar" }));
		expect(await screen.findByText("✓ Estrutura válida para a revisão atual")).toBeTruthy();
		await user.click(publish);
		await user.type(screen.getByRole("textbox", { name: "Motivo da publicação" }), "Fluxo revisado");
		await user.click(screen.getByRole("button", { name: "Confirmar publicação" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflow-definitions/main/publish", expect.objectContaining({ method: "POST" })));
		const request = fetchMock.mock.calls.find(([url, options]) => url === "/api/workflow-definitions/main/publish" && options?.method === "POST");
		expect(JSON.parse(request?.[1]?.body as string)).toEqual({ expectedRevision: 2, reason: "Fluxo revisado" });
	});

	it("edits roles and the preferred executor from available registries in the draft", async () => {
		const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Flow", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH") return jsonResponse({ number: null, revision: 2, content: JSON.parse(options.body as string).content });
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { name: "Flow", initialStageId: "code", stages: [{ id: "code", name: "Code", zone: "doing", final: true, transitions: [] }] } });
			if (url === "/api/workflow/active-flow") return jsonResponse({ roles: [{ id: "implementer", label: "Implementer", allowedStages: ["code"] }, { id: "reviewer", label: "Reviewer", allowedStages: ["review"] }] });
			if (url === "/api/workflow/adapters") return jsonResponse([{ id: "codex", displayName: "Codex", active: true, detected: true }, { id: "cursor", displayName: "Cursor", active: false, detected: true }]);
			return new Response(null, { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		const actors = await screen.findByRole("group", { name: "Quem atua" });
		await user.click(within(actors).getByRole("button", { name: "Implementer" }));
		expect(within(actors).queryByRole("button", { name: "Reviewer" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Executor preferencial" }));
		await user.click(await screen.findByRole("option", { name: "Codex" }));
		await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflow-definitions/main/draft", expect.objectContaining({ method: "PATCH" })));
		const request = fetchMock.mock.calls.find(([url, options]) => url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH");
		expect(JSON.parse(request?.[1]?.body as string).content.stages[0]).toMatchObject({ allow: ["implementer"], preferredExecutor: "codex" });
	});

	it("selects a configured harness gate and saves it only in the draft", async () => {
		const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Flow", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH") return jsonResponse({ number: null, revision: 2, content: JSON.parse(options.body as string).content });
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { name: "Flow", initialStageId: "code", stages: [{ id: "code", name: "Code", zone: "doing", final: true, transitions: [] }] } });
			if (url === "/api/harness/templates") return jsonResponse([{ id: "flow-main", gates: [{ id: "code-reviewed", type: "automated" }, { id: "human-approved", type: "human" }] }]);
			return new Response(null, { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		await screen.findByRole("textbox", { name: "Nome do estágio" });
		await user.click(screen.getByRole("button", { name: "Gate" }));
		await user.click(await screen.findByRole("option", { name: "code-reviewed · automated" }));
		await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflow-definitions/main/draft", expect.objectContaining({ method: "PATCH" })));
		const request = fetchMock.mock.calls.find(([url, options]) => url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH");
		expect(JSON.parse(request?.[1]?.body as string).content.stages[0].gate).toBe("code-reviewed");
	});

	it("adds and renames an internal phase without losing existing phase rules", async () => {
		const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
			if (url === "/api/workflow-definitions") return jsonResponse([{ id: "main", name: "Flow", activeVersionId: null, draftVersionId: "draft" }]);
			if (url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH") return jsonResponse({ number: null, revision: 2, content: JSON.parse(options.body as string).content });
			if (url === "/api/workflow-definitions/main/draft") return jsonResponse({ number: null, revision: 1, content: { name: "Flow", initialStageId: "code", stages: [{ id: "code", name: "Code", final: true, phases: { initialState: "work", states: { work: { id: "work", label: "Trabalho", description: "", actions: [{ type: "notify-human", message: "Pronto" }], transitions: [] } } } }] } });
			return new Response(null, { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		render(<WorkflowDefinitionPage onBack={vi.fn()} />);
		const phases = await screen.findByRole("group", { name: "Fases internas" });
		await user.click(within(phases).getByRole("button", { name: "Adicionar fase" }));
		const labels = within(phases).getAllByRole("textbox", { name: "Nome da fase" });
		await user.clear(labels[1]);
		await user.type(labels[1], "Revisão");
		await user.click(within(phases).getByRole("button", { name: "Definir Revisão como fase inicial" }));
		await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflow-definitions/main/draft", expect.objectContaining({ method: "PATCH" })));
		const request = fetchMock.mock.calls.find(([url, options]) => url === "/api/workflow-definitions/main/draft" && options?.method === "PATCH");
		const saved = JSON.parse(request?.[1]?.body as string).content.stages[0].phases;
		expect(saved.initialState).toBe("phase-1");
		expect(saved.states["phase-1"]).toMatchObject({ id: "phase-1", label: "Revisão", description: "", transitions: [] });
		expect(saved.states.work.actions).toEqual([{ type: "notify-human", message: "Pronto" }]);
	});
});
