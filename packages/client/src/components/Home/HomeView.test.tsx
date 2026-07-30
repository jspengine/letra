import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Workflow } from "@letra/types";
import HomeView from "./HomeView";

const workflow: Workflow = {
	version: "1",
	name: "Letra",
	createdAt: "2026-07-01T00:00:00.000Z",
	updatedAt: "2026-07-25T00:00:00.000Z",
	tools: [],
	stages: [
		{ id: "review", name: "Review", order: 1, zone: "doing" },
	],
	items: [
		{
			id: "ITEM-29",
			description: "Central de Diagnosticos e Alertas de Saude do Letra",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
			spec: "diagnostics-hub",
		},
	],
	primaryItemId: "ITEM-29",
};

function mockFetch() {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url === "/api/focus") {
			return Response.json({ active: true, spec: "diagnostics-hub" });
		}
		if (url === "/api/health") {
			return Response.json({
				summary: { novo: 1, ciente: 0, resolvido: 0, descartado: 0 },
				active: [
					{
						id: "snapshot-bloat",
						title: "Snapshot payload excede 50KB",
						source: "snapshot-bloat",
						severity: "alta",
						status: "novo",
						detectedAt: "2026-07-25T10:00:00.000Z",
					},
				],
				entries: [],
			});
		}
		if (url.startsWith("/api/diagnostics/snapshots")) {
			return Response.json({
				snapshots: [
					{
						id: "snap-1",
						timestamp: "2026-07-25T10:02:00.000Z",
						diagnosticId: "snapshot-bloat",
						diagnosticTitle: "Snapshot payload excede 50KB",
						files: [
							{
								path: ".letra/snapshots/snap-1.json",
								before: "before",
								after: "after",
							},
						],
					},
				],
			});
		}
		if (url.startsWith("/api/log")) {
			return Response.json({ entries: [] });
		}
		return Response.json({});
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HomeView diagnostics center", () => {
	it("opens an accessible signal detail sheet with bounded diagnostic evidence", async () => {
		const user = userEvent.setup();
		mockFetch();

		render(<HomeView workflow={workflow} activeFlow={null} />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Saude do workspace" })).toBeTruthy();
		});

		await user.click(screen.getByRole("button", { name: "Detalhes" }));

		const dialog = screen.getByRole("dialog", { name: "Snapshot payload excede 50KB" });
		expect(dialog.getAttribute("aria-describedby")).toBe("signal-sheet-description");
		expect(screen.getByRole("heading", { name: "Comparacao de drift" })).toBeTruthy();
		expect(screen.getByText(".letra/snapshots/snap-1.json")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Fechar detalhes do sinal" })).toBeTruthy();
	});

	it("uses supervised health actions without leaving the diagnostics center", async () => {
		const user = userEvent.setup();
		const fetchMock = mockFetch();

		render(<HomeView workflow={workflow} activeFlow={null} />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Saude do workspace" })).toBeTruthy();
		});

		await user.click(screen.getByRole("button", { name: "Verificar agora" }));
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith("/api/health/scan", expect.objectContaining({ method: "POST" }));
		});

		await user.click(screen.getByRole("button", { name: "Detalhes" }));
		await user.click(screen.getByRole("button", { name: "Acompanhar" }));
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/health/ack",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ id: "snapshot-bloat" }),
				}),
			);
		});

		await user.click(screen.getByRole("button", { name: "Descartar" }));
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/health/dismiss",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ id: "snapshot-bloat" }),
				}),
			);
		});
	});
});
