import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkspaceSetupFlow from "./WorkspaceSetupFlow";

function proposal(overrides: Record<string, unknown> = {}) {
	return {
		id: "proposal-1",
		workspace: { name: "Acme", root: "C:/Workspace/acme", harnessVersion: "1.0.0" },
		warnings: [],
		locations: [{
			id: "frontend",
			label: "Frontend",
			path: "C:/Workspace/acme/frontend",
			stack: ["React", "TypeScript"],
			evidence: ["package.json"],
			adapters: [
				{ tool: "opencode", label: "OpenCode", state: "detected", selected: true, evidence: ["AGENTS.md"] },
				{ tool: "cursor", label: "Cursor", state: "available", selected: false, evidence: [] },
			],
		}],
		...overrides,
	};
}

describe("WorkspaceSetupFlow", () => {
	it("analyzes one project folder and keeps adapters in advanced options before planning", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({ ok: true, json: async () => proposal() })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					proposalId: "proposal-1",
					workspaceRoot: "~/.letra/workspaces/acme",
					conflictCount: 0,
					operations: [{ kind: "create", path: "~/.letra/workspaces/acme/workflow.json", reason: "Harness" }],
				}),
			});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();

		render(<WorkspaceSetupFlow onComplete={vi.fn()} onCancel={vi.fn()} existingNames={[]} />);
		await user.type(screen.getByLabelText("Nome do workspace"), "Acme");
		await user.type(screen.getByLabelText("Pasta/projeto inicial"), "C:/Workspace/acme");
		expect(screen.getByLabelText("Data directory do workspace")).toHaveProperty("value", "~/.letra/workspaces/acme");
		await user.click(screen.getByRole("button", { name: "Analisar pasta/projeto" }));

		expect(await screen.findByRole("heading", { name: "Proposta do Letra" })).toBeTruthy();
		expect(screen.getByText("React")).toBeTruthy();
		expect(screen.getByText("Opções avançadas")).toBeTruthy();
		expect(screen.getByText("detectado")).toBeTruthy();

		await user.click(screen.getByRole("checkbox", { name: "Cursor em Frontend" }));
		await user.click(screen.getByRole("button", { name: "Gerar prévia de escrita" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(request).toEqual(expect.objectContaining({
			proposalId: "proposal-1",
			workspaceRoot: "~/.letra/workspaces/acme",
			dataDir: "~/.letra/workspaces/acme",
			locations: [
				{
					id: "frontend",
					label: "Frontend",
					path: "C:/Workspace/acme/frontend",
					adapters: ["opencode", "cursor"],
				},
			],
		}));
		expect(await screen.findByRole("heading", { name: "Prévia de escrita" })).toBeTruthy();
		expect(screen.getByText("Criado em ~/.letra/workspaces/acme/workflow.json")).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Workspace e pastas/projetos" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Criar workspace" })).toBeTruthy();
	});

	it("allows the simplified happy path without selecting adapters", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => proposal({
					id: "proposal-no-adapters",
					locations: [{
						id: "backend",
						label: "Backend",
						path: "C:/Workspace/acme/backend",
						stack: ["Node"],
						evidence: ["package.json"],
						adapters: [
							{ tool: "opencode", label: "OpenCode", state: "available", selected: false, evidence: [] },
						],
					}],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					proposalId: "proposal-no-adapters",
					workspaceRoot: "~/.letra/workspaces/acme",
					conflictCount: 0,
					operations: [{ kind: "create", path: "~/.letra/workspaces/acme/workflow.json", reason: "Harness" }],
				}),
			});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();

		render(<WorkspaceSetupFlow onComplete={vi.fn()} onCancel={vi.fn()} existingNames={[]} />);
		await user.type(screen.getByLabelText("Nome do workspace"), "Acme");
		await user.type(screen.getByLabelText("Pasta/projeto inicial"), "C:/Workspace/acme");
		await user.click(screen.getByRole("button", { name: "Analisar pasta/projeto" }));
		await user.click(await screen.findByRole("button", { name: "Gerar prévia de escrita" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(request.locations).toEqual([{
			id: "backend",
			label: "Backend",
			path: "C:/Workspace/acme/backend",
			adapters: [],
		}]);
		expect(await screen.findByText("Nenhum adapter selecionado")).toBeTruthy();
	});

	it("confirms creation with reviewed project folders and shows link validation checklist", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({ ok: true, json: async () => proposal({ id: "proposal-2" }) })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					proposalId: "proposal-2",
					workspaceRoot: "~/.letra/workspaces/acme",
					conflictCount: 0,
					operations: [
						{ kind: "create", path: "~/.letra/workspaces/acme/workflow.json", reason: "Harness" },
						{ kind: "create", path: "C:/Workspace/acme/frontend/.letra-link", reason: "Vinculo" },
					],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					workspace: {
						id: "ws_1",
						name: "Acme",
						slug: "acme",
						root: "~/.letra/workspaces/acme",
						dataDir: "~/.letra/workspaces/acme",
						createdAt: "2026-08-17T00:00:00.000Z",
					},
					workflow: { name: "Acme", tools: ["opencode"] },
					rollbackId: "setup-1",
				}),
			});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();
		const onComplete = vi.fn();

		render(<WorkspaceSetupFlow onComplete={onComplete} onCancel={vi.fn()} existingNames={[]} />);
		await user.type(screen.getByLabelText("Nome do workspace"), "Acme");
		await user.type(screen.getByLabelText("Descrição opcional"), "Workspace Acme");
		await user.type(screen.getByLabelText("Pasta/projeto inicial"), "C:/Workspace/acme");
		await user.click(screen.getByRole("button", { name: "Analisar pasta/projeto" }));
		await user.click(await screen.findByRole("button", { name: "Gerar prévia de escrita" }));
		await user.click(await screen.findByRole("button", { name: "Criar workspace" }));

		await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ name: "Acme" }));
		const request = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
		expect(request).toEqual(expect.objectContaining({
			proposalId: "proposal-2",
			name: "Acme",
			description: "Workspace Acme",
			workspacePath: "~/.letra/workspaces/acme",
			dataDir: "~/.letra/workspaces/acme",
			directories: ["C:/Workspace/acme/frontend"],
			tools: ["opencode"],
			template: "padrao",
		}));
		expect(request.locations).toEqual([{
			id: "frontend",
			label: "Frontend",
			path: "C:/Workspace/acme/frontend",
			adapters: ["opencode"],
		}]);
		expect(await screen.findByRole("heading", { name: "Workspace criado!" })).toBeTruthy();
		expect(screen.getByText("Validar workflow.json")).toBeTruthy();
		expect(screen.getByText("Validar .letra-link")).toBeTruthy();
		expect(screen.getByText("Validar pastas/projetos")).toBeTruthy();
	});

	it("is keyboard-accessible, responsive and valid in the dark theme", async () => {
		document.documentElement.classList.add("dark");
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const { container } = render(
			<WorkspaceSetupFlow onComplete={vi.fn()} onCancel={onCancel} existingNames={[]} />,
		);

		const cancel = screen.getByRole("button", { name: "Voltar para Meus Workspaces" });
		cancel.focus();
		await user.keyboard("{Enter}");
		expect(onCancel).toHaveBeenCalledOnce();
		const nameInput = screen.getByLabelText("Nome do workspace");
		nameInput.focus();
		await user.tab();
		expect(document.activeElement).toBe(screen.getByLabelText("Descrição opcional"));
		await user.tab();
		expect(document.activeElement).toBe(screen.getByLabelText("Data directory do workspace"));

		expect(container.innerHTML).toContain("lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]");
		expect(container.innerHTML).toContain("sm:grid-cols-[1fr_auto]");

		const { default: axe } = await import("axe-core");
		const results = await axe.run(container, {
			rules: { "color-contrast": { enabled: false } },
		});
		expect(results.violations.map((violation) => violation.id)).toEqual([]);
		document.documentElement.classList.remove("dark");
	});
});
