import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@letra/ui";
import Header from "./Header";
import type { WorkspaceData } from "../Workspaces/WorkspacesView";

const workspace: WorkspaceData = {
	id: "workspace-1",
	name: "Letra",
	slug: "letra",
	createdAt: "2026-07-04T00:00:00.000Z",
	directories: ["C:/Workspace/letra/packages/client", "C:/Workspace/letra/packages/cli"],
};

const anotherWorkspace: WorkspaceData = {
	id: "workspace-2",
	name: "Sandbox",
	slug: "sandbox",
	createdAt: "2026-07-05T00:00:00.000Z",
	directories: ["C:/Workspace/sandbox/packages/app"],
};

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	});
});

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
	const props: React.ComponentProps<typeof Header> = {
		theme: "dark",
		onThemeChange: vi.fn(),
		workspaces: [workspace],
		activeWorkspace: workspace,
		activeDirectory: workspace.directories?.[0],
		onWorkspaceChange: vi.fn(),
		onDirectoryChange: vi.fn(),
		onOpenHistory: vi.fn(),
		health: { activeAlerts: 8, criticalAlerts: 2 },
		gateCount: 2,
		...overrides,
	};

	return {
		props,
		...render(
			<SidebarProvider>
				<Header {...props} />
			</SidebarProvider>,
		),
	};
}

describe("Header", () => {
	it("exposes global navigation, context and actionable signals", () => {
		renderHeader();

		expect(screen.getByRole("button", { name: "Recolher menu global" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Contexto atual: workspace Letra, escopo client" })).toBeTruthy();
		expect(
			screen.getByRole("button", {
				name: "Abrir supervisao: 2 decisoes pendentes, 8 sinais ativos, 2 bloqueiam conclusao",
			}),
		).toBeTruthy();
		expect(screen.queryByRole("status", { name: "2 decisoes pendentes" })).toBeNull();
	});

	it("changes the active scope without changing the workspace", async () => {
		const user = userEvent.setup();
		const { props } = renderHeader();

		await user.click(screen.getByRole("button", { name: "Contexto atual: workspace Letra, escopo client" }));
		await user.click(screen.getByRole("option", { name: "Todo o workspace" }));

		expect(props.onDirectoryChange).toHaveBeenCalledWith(null);
		expect(props.onWorkspaceChange).not.toHaveBeenCalled();
	});

	it("changes the active workspace from the same context menu", async () => {
		const user = userEvent.setup();
		const { props } = renderHeader({
			workspaces: [workspace, anotherWorkspace],
		});

		await user.click(screen.getByRole("button", { name: "Contexto atual: workspace Letra, escopo client" }));
		await user.click(screen.getByRole("option", { name: "Sandbox" }));

		expect(props.onWorkspaceChange).toHaveBeenCalledWith(anotherWorkspace);
		expect(props.onDirectoryChange).not.toHaveBeenCalled();
	});

	it("keeps zero and unavailable states out of the global header", () => {
		renderHeader({ health: null, gateCount: 0 });

		expect(screen.queryByRole("button", { name: /saude/i })).toBeNull();
		expect(screen.queryByRole("status", { name: "Nenhuma decisao pendente" })).toBeNull();
	});

	it("opens supervision from the health signal in the header", async () => {
		const user = userEvent.setup();
		const onOpenHealthCenter = vi.fn();
		renderHeader({ onOpenHealthCenter });

		await user.click(screen.getByRole("button", { name: "Abrir supervisao: 2 decisoes pendentes, 8 sinais ativos, 2 bloqueiam conclusao" }));

		expect(onOpenHealthCenter).toHaveBeenCalledOnce();
	});

	it("keeps history and theme as global utilities without pending-state copy", () => {
		renderHeader();

		expect(screen.queryByRole("button", { name: "Historico de correcoes" })).toBeNull();
		expect(screen.getByRole("button", { name: "Alternar para tema claro" })).toBeTruthy();
	});

	it("does not expose diagnostic corrections as a global header metric", () => {
		renderHeader({
			activeWorkspace: null,
			activeDirectory: null,
			health: null,
			gateCount: 0,
		});

		expect(screen.getByRole("button", { name: "Contexto atual: workspace Escolha um workspace, escopo Todo o workspace" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /correc/ })).toBeNull();
	});
});
