import { ToastProvider } from "@letra/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import KanbanBoard from "./KanbanBoard";

// ITEM-64 (spec board-cria-item): the board offers item creation whenever the
// flow has a first stage, not only when it is empty.

const workflow = {
	version: "1.0",
	name: "Board",
	createdAt: "2026-11-25T00:00:00.000Z",
	updatedAt: "2026-11-25T00:00:00.000Z",
	stages: [
		{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
		{ id: "design", name: "Design", order: 1, zone: "doing" },
	],
	items: [{ id: "ITEM-1", description: "Existing item", stage: "backlog", createdAt: "2026-11-25T00:00:00.000Z" }],
	tools: [],
};

function renderBoard(onAddItem?: () => void) {
	render(
		<ToastProvider>
			<KanbanBoard
				workflow={workflow as never}
				activeFlow={null}
				onSelectItem={vi.fn()}
				onDropItem={vi.fn()}
				onAddItem={onAddItem}
			/>
		</ToastProvider>,
	);
}

describe("KanbanBoard — add item (ITEM-64)", () => {
	it("shows Adicionar item on a board that already has items and calls the handler", async () => {
		const onAddItem = vi.fn();
		renderBoard(onAddItem);
		const button = screen.getByRole("button", { name: /Adicionar item/ });
		await userEvent.setup().click(button);
		expect(onAddItem).toHaveBeenCalledTimes(1);
	});

	it("hides the action when no handler is wired", () => {
		renderBoard(undefined);
		expect(screen.queryByRole("button", { name: /Adicionar item/ })).toBeNull();
	});
});
