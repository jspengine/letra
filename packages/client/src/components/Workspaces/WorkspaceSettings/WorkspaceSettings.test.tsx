import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ToastProvider } from "@letra/ui";
import WorkspaceSettings from "./WorkspaceSettings";
import type { WorkspaceData } from "../WorkspacesView";

const workspace: WorkspaceData = {
	id: "workspace-1",
	name: "Letra",
	slug: "letra",
	root: "C:/Workspace/letra",
	dataDir: "C:/Users/rnasc/.letra/workspaces/letra",
	createdAt: "2026-08-01T00:00:00.000Z",
	description: "Controle de entrega assistida por agentes",
	directories: [],
	tools: [],
	template: "sdlc",
};

interface TestLocation {
	id: string;
	path: string;
	label: string;
	adapters?: string[];
	linkStatus?: "ok" | "missing" | "broken" | "unknown";
	linkOk?: boolean;
}

interface MockFetchOptions {
	locations?: TestLocation[];
	dirs?: Array<{ name: string; path: string }>;
	templates?: Array<{
		id: string;
		name: string;
		description?: string;
		stages: Array<{ id: string; name: string }>;
	}>;
	adapters?: Array<{
		id: string;
		displayName: string;
		capabilities: { instructions: boolean; skills: boolean; mcp: boolean; hooks: boolean };
		detectionPaths: string[];
		active: boolean;
		detected: boolean;
	}>;
}

function jsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), {
		status: init?.status ?? 200,
		headers: { "Content-Type": "application/json" },
	});
}

function bodyFrom(init?: RequestInit) {
	return JSON.parse(String(init?.body ?? "{}"));
}

function mockFetch(options: MockFetchOptions = {}) {
	const locations = options.locations ?? [];
	const dirs = options.dirs ?? [];
	const templates = options.templates ?? [
		{
			id: "sdlc",
			name: "SDLC",
			stages: [
				{ id: "backlog", name: "Backlog" },
				{ id: "code", name: "Code" },
			],
		},
	];
	const adapters = options.adapters ?? [
		{
			id: "opencode",
			displayName: "OpenCode",
			capabilities: { instructions: true, skills: true, mcp: false, hooks: false },
			detectionPaths: ["AGENTS.md"],
			active: true,
			detected: true,
		},
	];
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";

		if (url === "/api/workflow" && method === "GET") {
			return jsonResponse({
				name: workspace.name,
				description: workspace.description,
				template: "sdlc",
				stages: [
					{ id: "backlog", name: "Backlog" },
					{ id: "code", name: "Code" },
				],
				locations,
				tools: ["opencode"],
			});
		}

		if (url.startsWith("/api/fs/dirs")) {
			return jsonResponse({
				path: "C:/Workspace/letra",
				dirs,
			});
		}

		if (url === "/api/harness/templates") {
			return jsonResponse(templates);
		}

		if (url === "/api/workflow/adapters") {
			return jsonResponse(adapters);
		}

		if (url === "/api/workflow" && method === "PATCH") {
			const body = bodyFrom(init);
			return jsonResponse({ ...body });
		}

		if (url === "/api/workflow/template" && method === "POST") {
			const body = bodyFrom(init);
			const template = templates.find((candidate) => candidate.id === body.template);
			return jsonResponse({
				template: body.template,
				stages: template?.stages ?? [],
				items: [{ id: "ITEM-2", description: "Moved", stage: "backlog" }],
			});
		}

		if (url === "/api/workflow/adapters" && method === "PATCH") {
			return jsonResponse(bodyFrom(init));
		}

		if (url === "/api/workflow/locations" && method === "POST") {
			return jsonResponse(bodyFrom(init));
		}

		if (url.startsWith("/api/workflow/locations/") && method === "PATCH") {
			const id = url.split("/").at(-1);
			const previous = locations.find((location) => location.id === id);
			return jsonResponse({
				...previous,
				...bodyFrom(init),
			});
		}

		if (url.startsWith("/api/workflow/locations/") && method === "DELETE") {
			return jsonResponse({ ok: true });
		}

		if (url.startsWith("/api/workflow/locations/") && url.endsWith("/repair-link") && method === "POST") {
			const id = url.split("/").at(-2);
			const previous = locations.find((location) => location.id === id);
			return jsonResponse({
				ok: true,
				location: {
					...previous,
					linkStatus: "ok",
					linkOk: true,
				},
				linkPath: `${previous?.path}/.letra-link`,
				dataDir: workspace.dataDir,
			});
		}

		if (url === "/api/workspaces/workspace-1" && method === "DELETE") {
			return jsonResponse({ ok: true });
		}

		return jsonResponse({ ok: true });
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function renderSettings(props: Partial<React.ComponentProps<typeof WorkspaceSettings>> = {}) {
	return render(
		<ToastProvider>
			<WorkspaceSettings
				workspace={workspace}
				onWorkspaceUpdated={vi.fn()}
				onWorkspaceDeleted={vi.fn()}
				onRefreshWorkflow={vi.fn()}
				{...props}
			/>
		</ToastProvider>,
	);
}

describe("WorkspaceSettings", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockFetch();
	});

	it("renders as a dedicated settings page without a primary drawer close action", () => {
		renderSettings();

		expect(screen.getByRole("heading", { name: "Configurações do Workspace" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Fechar configurações do workspace" })).toBeNull();
	});

	it("exposes a New workspace action from the settings page header", async () => {
		const user = userEvent.setup();
		const onCreateWorkspace = vi.fn();
		renderSettings({ onCreateWorkspace });

		await user.click(screen.getByRole("button", { name: "Novo workspace" }));

		expect(onCreateWorkspace).toHaveBeenCalledOnce();
	});

	it("adds internal responsive padding around tab content", () => {
		renderSettings();

		expect(screen.getByTestId("workspace-settings-tab-panel").getAttribute("class")).toContain("px-4 py-5");
	});

	it("blocks saving workspace identity when the name is shorter than two characters", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch();
		renderSettings();

		const nameInput = screen.getByPlaceholderText("Nome do workspace");
		await user.clear(nameInput);
		await user.type(nameInput, "L");

		expect(screen.getByText("Mínimo 2 caracteres")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/workflow",
			expect.objectContaining({ method: "PATCH" }),
		);
	});

	it("saves workspace identity, keeps the page live, and exposes a clickable undo action", async () => {
		const user = userEvent.setup();
		const onWorkspaceUpdated = vi.fn();
		const fetchMock = mockFetch();
		renderSettings({ onWorkspaceUpdated });

		const nameInput = screen.getByPlaceholderText("Nome do workspace");
		const descriptionInput = screen.getByPlaceholderText("Descreva o propósito deste workspace");
		await user.clear(nameInput);
		await user.type(nameInput, "Letra Produto");
		await user.clear(descriptionInput);
		await user.type(descriptionInput, "Governança do produto Letra");
		await user.click(screen.getByRole("button", { name: "Salvar" }));

		await waitFor(() => expect(onWorkspaceUpdated).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({
					name: "Letra Produto",
					description: "Governança do produto Letra",
				}),
			}),
		);
		expect(onWorkspaceUpdated).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Letra Produto",
				description: "Governança do produto Letra",
			}),
		);
		await user.click(await screen.findByRole("button", { name: "Desfazer" }));

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({
					name: "Letra",
					description: "Controle de entrega assistida por agentes",
				}),
			}),
		);
		expect(nameInput).toHaveProperty("value", "Letra");
		expect(descriptionInput).toHaveProperty("value", "Controle de entrega assistida por agentes");
		expect(onWorkspaceUpdated).toHaveBeenLastCalledWith(
			expect.objectContaining({
				name: "Letra",
				description: "Controle de entrega assistida por agentes",
			}),
		);
	});

	it("shows the locations empty state and opens the first-location action", async () => {
		const user = userEvent.setup();
		mockFetch();
		renderSettings();

		await user.click(screen.getByRole("tab", { name: "Pastas/projetos" }));

		expect(await screen.findByText("Nenhuma pasta/projeto vinculada")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Adicionar primeira pasta" }));

		expect(await screen.findByRole("heading", { name: "Selecionar diretório" })).toBeTruthy();
	});

	it("adds a location from the directory browser with a full path preview", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch({
			dirs: [{ name: "frontend", path: "C:/Workspace/letra/frontend" }],
		});
		renderSettings();

		await user.click(screen.getByRole("tab", { name: "Pastas/projetos" }));
		await user.click(await screen.findByRole("button", { name: "Adicionar primeira pasta" }));
		await user.click(await screen.findByRole("button", { name: "frontend" }));

		expect(screen.getByText("Diretório selecionado")).toBeTruthy();
		expect(screen.getByText("C:/Workspace/letra/frontend")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Adicionar" }));

		await waitFor(() => expect(screen.getByText("frontend")).toBeTruthy());
		const postCall = fetchMock.mock.calls.find(
			([url, init]) => url === "/api/workflow/locations" && init?.method === "POST",
		);
		expect(postCall).toBeTruthy();
		expect(bodyFrom(postCall?.[1])).toEqual(
			expect.objectContaining({
				path: "C:/Workspace/letra/frontend",
				label: "frontend",
			}),
		);
	});

	it("shows data directory, link status, repair action, and collapsed location adapters", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch({
			locations: [
				{
					id: "loc-client",
					path: "C:/Workspace/letra/packages/client",
					label: "Client",
					adapters: ["opencode"],
					linkStatus: "missing",
					linkOk: false,
				},
			],
		});
		renderSettings();

		await user.click(screen.getByRole("tab", { name: "Pastas/projetos" }));

		expect(await screen.findByLabelText("Data directory do workspace")).toHaveProperty("value", "C:/Users/rnasc/.letra/workspaces/letra");
		expect(screen.getByText(".letra-link ausente")).toBeTruthy();
		expect(screen.getByText("Adapters da pasta")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Reparar vínculo da pasta Client" }));

		await waitFor(() => expect(screen.getByText("Vínculo ok")).toBeTruthy());
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/locations/loc-client/repair-link",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("edits location labels by Escape, button, and Enter without touching other locations", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch({
			locations: [
				{ id: "loc-client", path: "C:/Workspace/letra/packages/client", label: "Client" },
				{ id: "loc-cli", path: "C:/Workspace/letra/packages/cli", label: "CLI" },
			],
		});
		renderSettings();

		await user.click(screen.getByRole("tab", { name: "Pastas/projetos" }));
		expect(await screen.findByText("Client")).toBeTruthy();
		expect(screen.getByText("CLI")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Editar label da pasta Client" }));
		await user.clear(screen.getByLabelText("Label do local Client"));
		await user.type(screen.getByLabelText("Label do local Client"), "Rascunho");
		await user.keyboard("{Escape}");

		expect(screen.getByText("Client")).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/workflow/locations/loc-client",
			expect.objectContaining({ method: "PATCH" }),
		);

		await user.click(screen.getByRole("button", { name: "Editar label da pasta Client" }));
		await user.clear(screen.getByLabelText("Label do local Client"));
		await user.type(screen.getByLabelText("Label do local Client"), "Interface");
		await user.click(screen.getByRole("button", { name: "Salvar local Client" }));

		expect(await screen.findByText("Interface")).toBeTruthy();
		expect(screen.getByText("CLI")).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/locations/loc-client",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ label: "Interface" }),
			}),
		);

		await user.click(screen.getByRole("button", { name: "Editar label da pasta Interface" }));
		await user.clear(screen.getByLabelText("Label do local Interface"));
		await user.type(screen.getByLabelText("Label do local Interface"), "Frontend UI");
		await user.keyboard("{Enter}");

		expect(await screen.findByText("Frontend UI")).toBeTruthy();
		expect(screen.getByText("CLI")).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/locations/loc-client",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ label: "Frontend UI" }),
			}),
		);
	});

	it("removes a location with confirmation and restores it through undo", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch({
			locations: [
				{ id: "loc-client", path: "C:/Workspace/letra/packages/client", label: "Client" },
			],
		});
		renderSettings();

		await user.click(screen.getByRole("tab", { name: "Pastas/projetos" }));
		expect(await screen.findByText("Client")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Remover vínculo da pasta Client" }));
		expect(screen.getByText("Remover C:/Workspace/letra/packages/client?")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(screen.getByText("Client")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Remover vínculo da pasta Client" }));
		await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));

		await waitFor(() => expect(screen.queryByText("Client")).toBeNull());
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/locations/loc-client",
			expect.objectContaining({ method: "DELETE" }),
		);

		await user.click(await screen.findByRole("button", { name: "Desfazer" }));
		expect(await screen.findByText("Client")).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/locations",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					id: "loc-client",
					path: "C:/Workspace/letra/packages/client",
					label: "Client",
				}),
			}),
		);
	});

	it("switches workflow template with explicit diff and backlog preservation copy", async () => {
		const user = userEvent.setup();
		const onRefreshWorkflow = vi.fn();
		const fetchMock = mockFetch({
			templates: [
				{
					id: "sdlc",
					name: "SDLC",
					stages: [
						{ id: "backlog", name: "Backlog" },
						{ id: "code", name: "Code" },
					],
				},
				{
					id: "review-only",
					name: "Review only",
					stages: [
						{ id: "backlog", name: "Backlog" },
						{ id: "review", name: "Review" },
					],
				},
			],
		});
		renderSettings({ onRefreshWorkflow });

		await user.click(screen.getByRole("tab", { name: "Fluxo" }));
		await user.click(await screen.findByRole("button", { name: /Review only/ }));

		expect(screen.getByText("Inalterados: Backlog")).toBeTruthy();
		expect(screen.getByText("Adicionados: Review")).toBeTruthy();
		expect(screen.getByText("Removidos: Code")).toBeTruthy();
		expect(screen.getByText("Itens nesses estágios serão preservados no backlog.")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Aplicar template" }));

		await waitFor(() => expect(onRefreshWorkflow).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/template",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ template: "review-only" }),
			}),
		);
		expect(await screen.findByText("Template atual: review-only")).toBeTruthy();
		expect(await screen.findByRole("button", { name: "Desfazer" })).toBeTruthy();
	});

	it("shows adapter status, capabilities, expected files, and toggles active tools", async () => {
		const user = userEvent.setup();
		const onRefreshWorkflow = vi.fn();
		const fetchMock = mockFetch({
			adapters: [
				{
					id: "opencode",
					displayName: "OpenCode",
					capabilities: { instructions: true, skills: true, mcp: false, hooks: false },
					detectionPaths: [".opencode/instructions.md", "AGENTS.md"],
					active: true,
					detected: true,
				},
				{
					id: "cursor",
					displayName: "Cursor",
					capabilities: { instructions: true, skills: false, mcp: false, hooks: false },
					detectionPaths: [".cursorrules"],
					active: false,
					detected: false,
				},
			],
		});
		renderSettings({ onRefreshWorkflow });

		await user.click(screen.getByRole("tab", { name: "Adapters" }));

		const opencode = await screen.findByRole("button", { name: "Desativar adapter OpenCode" });
		expect(opencode.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText("Detectado")).toBeTruthy();
		expect(screen.getAllByText("Instructions").length).toBeGreaterThan(0);
		expect(screen.getByText("Skills")).toBeTruthy();
		expect(screen.getByText("Arquivo(s) esperado(s): .opencode/instructions.md, AGENTS.md")).toBeTruthy();
		expect(screen.getByText("Arquivo(s) esperado(s): .cursorrules")).toBeTruthy();

		const cursor = screen.getByRole("button", { name: "Ativar adapter Cursor" });
		expect(cursor.getAttribute("aria-pressed")).toBe("false");
		await user.click(cursor);

		await waitFor(() => expect(onRefreshWorkflow).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/workflow/adapters",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ tools: ["opencode", "cursor"] }),
			}),
		);
		expect(await screen.findByRole("button", { name: "Desfazer" })).toBeTruthy();
	});

	it("requires typing the exact workspace name before permanent deletion", async () => {
		const user = userEvent.setup();
		const onWorkspaceDeleted = vi.fn();
		renderSettings({ onWorkspaceDeleted });

		await user.click(screen.getByRole("tab", { name: /Avan/ }));
		await user.click(screen.getByRole("button", { name: "Excluir Workspace" }));
		await user.click(screen.getByRole("button", { name: "Continuar" }));

		const deleteButton = screen.getByRole("button", { name: "Excluir permanentemente" });
		expect(deleteButton).toHaveProperty("disabled", true);

		await user.type(screen.getByLabelText("Digite o nome do workspace para confirmar exclusão"), "Letra");
		expect(deleteButton).toHaveProperty("disabled", false);
		await user.click(deleteButton);

		await waitFor(() => expect(onWorkspaceDeleted).toHaveBeenCalledOnce());
	});
});
