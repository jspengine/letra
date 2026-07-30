import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@letra/ui";
import Sidebar, { type Tab } from "./Sidebar";

const PRIMARY_DESTINATIONS: Array<{ id: Tab; label: string }> = [
	{ id: "supervision", label: "Supervisão" },
	{ id: "work", label: "Trabalho" },
	{ id: "knowledge", label: "Conhecimento e Regras" },
	{ id: "activity", label: "Atividade" },
];

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

function renderSidebar(onTabChange = vi.fn()) {
	return {
		onTabChange,
		...render(
			<SidebarProvider>
				<Sidebar
					activeTab="supervision"
					onTabChange={onTabChange}
					workspaceActive
				/>
			</SidebarProvider>,
		),
	};
}

function renderCollapsedSidebar(onTabChange = vi.fn()) {
	return {
		onTabChange,
		...render(
			<SidebarProvider defaultOpen={false}>
				<Sidebar
					activeTab="supervision"
					onTabChange={onTabChange}
					workspaceActive
				/>
			</SidebarProvider>,
		),
	};
}

describe("Sidebar", () => {
	it("exposes only the four primary destinations organized by user intent", () => {
		renderSidebar();

		for (const destination of PRIMARY_DESTINATIONS) {
			expect(screen.getByRole("button", { name: destination.label })).toBeTruthy();
		}

		for (const implementationLabel of [
			"Dashboard",
			"Meus Workspaces",
			"Papéis e atores",
			"Contexto",
			"Fluxo",
			"Especificações",
			"Quadro",
			"Auditoria",
		]) {
			expect(screen.queryByRole("button", { name: implementationLabel })).toBeNull();
		}
	});

	it("navigates using stable intent identifiers and exposes the active destination", async () => {
		const user = userEvent.setup();
		const { onTabChange } = renderSidebar();

		const supervision = screen.getByRole("button", { name: "Supervisão" });
		expect(supervision.getAttribute("data-active")).not.toBeNull();

		for (const destination of PRIMARY_DESTINATIONS) {
			await user.click(screen.getByRole("button", { name: destination.label }));
			expect(onTabChange).toHaveBeenLastCalledWith(destination.id);
		}
	});

	it("does not duplicate global workspace scope or pending decisions", () => {
		render(
			<SidebarProvider>
				<Sidebar
					activeTab="supervision"
					onTabChange={vi.fn()}
					workspaceActive
					activeWorkspace={{
						id: "workspace-1",
						name: "Letra",
						slug: "letra",
						createdAt: "2026-07-04T00:00:00.000Z",
						directories: ["C:/Workspace/letra/packages/client"],
					}}
					activeDirectory="C:/Workspace/letra/packages/client"
					gateCount={2}
				/>
			</SidebarProvider>,
		);

		expect(screen.queryByText("Pastas")).toBeNull();
		expect(screen.queryByRole("button", { name: "client" })).toBeNull();
		expect(screen.queryByText("2 gates pendentes")).toBeNull();
	});

	it("does not own the global collapse control", () => {
		renderSidebar();

		expect(screen.queryByRole("button", { name: "Recolher menu" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Expandir menu" })).toBeNull();
	});

	it("keeps collapsed navigation icon-only while preserving accessible labels", () => {
		const { container } = renderCollapsedSidebar();
		const supervisionButton = screen
			.getAllByRole("button")
			.find((button) => button.getAttribute("title")?.startsWith("Supervis"));

		expect(screen.getByLabelText("Letra L")).toBeTruthy();
		expect(supervisionButton?.getAttribute("title")).toBeTruthy();
		expect(supervisionButton?.getAttribute("class")).toContain("size-9");
		expect(supervisionButton?.getAttribute("class")).not.toContain("shadow-[inset");
		expect(container.querySelector('[data-sidebar-label="brand"]')?.getAttribute("class")).toContain("sr-only");

		for (const destination of PRIMARY_DESTINATIONS) {
			expect(container.querySelector(`[data-sidebar-label="${destination.id}"]`)?.getAttribute("class")).toContain("sr-only");
		}
	});
});
