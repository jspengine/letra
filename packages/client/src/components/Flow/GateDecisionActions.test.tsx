import { ToastProvider } from "@letra/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GateDecisionActions from "./GateDecisionActions";

function renderActions(onDecided = vi.fn()) {
	render(
		<ToastProvider>
			<GateDecisionActions itemId="ITEM-42" onDecided={onDecided} />
		</ToastProvider>,
	);
	return onDecided;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GateDecisionActions", () => {
	it("records approval for the exact item", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ decision: { value: "approve" } }),
		});
		vi.stubGlobal("fetch", fetchMock);
		const onDecided = renderActions();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "Aprovar" }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/items/ITEM-42/gate-decisions",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ decision: "approve" }),
				}),
			);
		});
		expect(onDecided).toHaveBeenCalledOnce();
		expect(await screen.findByText("Decisão aprovada e registrada.")).toBeTruthy();
	});

	it("requires and sends the reason for request-changes", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ decision: { value: "request-changes" } }),
		});
		vi.stubGlobal("fetch", fetchMock);
		renderActions();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "Solicitar alterações" }));
		const reason = screen.getByPlaceholderText(
			"Explique o direcionamento para manter a decisão auditável",
		);
		await user.type(reason, "Cobrir o cenário sem conexão");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/items/ITEM-42/gate-decisions",
				expect.objectContaining({
					body: JSON.stringify({
						decision: "request-changes",
						reason: "Cobrir o cenário sem conexão",
					}),
				}),
			);
		});
	});

	it("shows the server error instead of simulating success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				json: vi.fn().mockResolvedValue({ error: "Gate sem destino declarado" }),
			}),
		);
		const onDecided = renderActions();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "Aprovar" }));

		expect(await screen.findByText("Gate sem destino declarado")).toBeTruthy();
		expect(onDecided).not.toHaveBeenCalled();
	});
});
