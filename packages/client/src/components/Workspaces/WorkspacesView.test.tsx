import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkspacesView from "./WorkspacesView";

function mockWorkspaces(data: unknown[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => data,
		})),
	);
}

describe("WorkspacesView", () => {
	it("exposes workspace creation as a page action separate from settings", async () => {
		const user = userEvent.setup();
		mockWorkspaces([
			{
				id: "workspace-1",
				name: "Letra",
				slug: "letra",
				root: "C:/Workspace/letra",
				createdAt: "2026-08-17T00:00:00.000Z",
			},
		]);

		render(<WorkspacesView />);

		expect(await screen.findByRole("heading", { name: "Meus Workspaces" })).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Configurações do Workspace" })).toBeNull();

		await user.click(screen.getByRole("button", { name: "Novo workspace" }));

		expect(await screen.findByRole("heading", { name: "Novo workspace" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Origem da solução" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Prévia de escrita" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Analisar pasta" })).toBeTruthy();
	});

	it("uses the same New workspace CTA in the empty state", async () => {
		mockWorkspaces([]);

		render(<WorkspacesView />);

		expect(await screen.findByText("Nenhum workspace encontrado")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Novo workspace" }).length).toBeGreaterThan(0);
	});

	it("can open directly on the dedicated New workspace page", async () => {
		mockWorkspaces([]);

		render(<WorkspacesView startCreating />);

		expect(await screen.findByRole("heading", { name: "Novo workspace" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Origem da solução" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Analisar pasta" })).toBeTruthy();
	});

	it("refreshes the persisted workspace list after creating a workspace", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const onWorkspacesLoaded = vi.fn();
		const createdWorkspace = {
			id: "workspace-created",
			name: "anotei aqui",
			slug: "anotei-aqui",
			root: "C:/Workspace/workspace-letra-anotei-aqui",
			createdAt: "2026-08-18T14:07:15.628Z",
			directories: ["C:/Workspace/AnoteiAqui"],
		};
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			if (url === "/api/workspaces" && method === "GET") {
				const workspaceCalls = fetchMock.mock.calls.filter(
					([calledUrl]) => calledUrl === "/api/workspaces",
				).length;
				return {
					ok: true,
					json: async () => (workspaceCalls > 1 ? [createdWorkspace] : []),
				};
			}
			if (url === "/api/workspace/setup/analyze" && method === "POST") {
				return {
					ok: true,
					json: async () => ({
						id: "proposal-1",
						workspace: {
							name: "anotei aqui",
							root: "C:/Workspace/workspace-letra-anotei-aqui",
							harnessVersion: "1.0.0",
						},
						warnings: [],
						locations: [
							{
								id: "root",
								label: "Raiz",
								path: "C:/Workspace/workspace-letra-anotei-aqui",
								stack: ["TypeScript"],
								evidence: ["package.json"],
								adapters: [
									{
										tool: "opencode",
										label: "OpenCode",
										state: "detected",
										selected: true,
										evidence: ["AGENTS.md"],
									},
								],
							},
						],
					}),
				};
			}
			if (url === "/api/workspace/setup/plan" && method === "POST") {
				return {
					ok: true,
					json: async () => ({
						proposalId: "proposal-1",
						workspaceRoot: "C:/Workspace/workspace-letra-anotei-aqui",
						conflictCount: 0,
						operations: [
							{
								kind: "create",
								path: "C:/Workspace/workspace-letra-anotei-aqui/.letra/workflow.json",
								reason: "Harness",
							},
						],
					}),
				};
			}
			if (url === "/api/workflow/setup" && method === "POST") {
				return {
					ok: true,
					json: async () => ({ workspace: createdWorkspace }),
				};
			}
			return { ok: true, json: async () => ({ ok: true }) };
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<WorkspacesView
				onSelect={onSelect}
				onWorkspacesLoaded={onWorkspacesLoaded}
				startCreating
			/>,
		);

		await user.type(await screen.findByLabelText("Nome da solução"), "anotei aqui");
		await user.type(
			screen.getByLabelText("Pasta inicial"),
			"C:/Workspace/workspace-letra-anotei-aqui",
		);
		await user.click(screen.getByRole("button", { name: "Analisar pasta" }));
		await user.click(await screen.findByRole("button", { name: "Gerar prévia de escrita" }));
		await user.click(await screen.findByRole("button", { name: "Criar workspace" }));

		expect(await screen.findByText("anotei aqui")).toBeTruthy();
		expect(await screen.findByText("AnoteiAqui")).toBeTruthy();
		await waitFor(() => expect(onSelect).toHaveBeenCalledWith(createdWorkspace));
		await waitFor(() =>
			expect(onWorkspacesLoaded).toHaveBeenLastCalledWith([createdWorkspace]),
		);
		expect(
			fetchMock.mock.calls.filter(([url]) => url === "/api/workspaces").length,
		).toBeGreaterThanOrEqual(2);
	});
});
