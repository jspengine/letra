import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkspaceSetupFlow from "./WorkspaceSetupFlow";

describe("WorkspaceSetupFlow", () => {
	it("analyzes one folder and exposes an editable adapter matrix before planning", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "proposal-1",
					workspace: { name: "Acme", root: "C:/Workspace/acme", harnessVersion: "1.0.0" },
					warnings: [],
					targets: [{
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
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					proposalId: "proposal-1",
					workspaceRoot: "C:/Workspace/acme",
					conflictCount: 0,
					operations: [{ kind: "create", path: "C:/Workspace/acme/.letra/workflow.json", reason: "Harness" }],
				}),
			});
		vi.stubGlobal("fetch", fetchMock);
		const user = userEvent.setup();

		render(<WorkspaceSetupFlow onComplete={vi.fn()} onCancel={vi.fn()} existingNames={[]} />);
		await user.type(screen.getByLabelText("Nome da solução"), "Acme");
		await user.type(screen.getByLabelText("Pasta inicial"), "C:/Workspace/acme");
		await user.click(screen.getByRole("button", { name: "Analisar projetos" }));

		expect(await screen.findByRole("heading", { name: "Projetos e ferramentas detectados" })).toBeTruthy();
		expect(screen.getByText("React")).toBeTruthy();
		expect(screen.getByText("detectado")).toBeTruthy();

		await user.click(screen.getByRole("checkbox", { name: "Cursor em Frontend" }));
		await user.click(screen.getByRole("button", { name: "Revisar instalação" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(request.targets[0].adapters).toEqual(["opencode", "cursor"]);
		expect(await screen.findByRole("heading", { name: "Revisar e criar" })).toBeTruthy();
	});

	it("is keyboard-accessible, responsive and valid in the dark theme", async () => {
		document.documentElement.classList.add("dark");
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const { container } = render(
			<WorkspaceSetupFlow onComplete={vi.fn()} onCancel={onCancel} existingNames={[]} />,
		);

		const cancel = screen.getByRole("button", { name: "Cancelar" });
		cancel.focus();
		await user.keyboard("{Enter}");
		expect(onCancel).toHaveBeenCalledOnce();
		const nameInput = screen.getByLabelText("Nome da solução");
		nameInput.focus();
		await user.tab();
		expect(document.activeElement).toBe(screen.getByLabelText("Descrição opcional"));
		await user.tab();
		expect(document.activeElement).toBe(screen.getByLabelText("Pasta inicial"));

		expect(container.innerHTML).toContain("lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]");
		expect(container.innerHTML).toContain("sm:grid-cols-[1fr_auto]");

		const { default: axe } = await import("axe-core");
		const results = await axe.run(container, {
			rules: { "color-contrast": { enabled: false } },
		});
		expect(results.violations.map((violation) => violation.id)).toEqual([]);
		document.documentElement.classList.remove("dark");
	});
});
