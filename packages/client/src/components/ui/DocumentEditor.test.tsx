import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentEditor } from "./DocumentEditor";

const initialContent = "# Documento\n\nConteúdo inicial";

function renderEditor(onSave = vi.fn().mockResolvedValue(undefined)) {
	render(
		<DocumentEditor
			file="context.md"
			initialContent={initialContent}
			onSave={onSave}
			title="Contexto"
		/>,
	);
	return { onSave };
}

describe("DocumentEditor", () => {
	it("renders the document in read mode", () => {
		renderEditor();

		expect(screen.getByText("Conteúdo inicial")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
	});

	it("toggles to edit mode", async () => {
		const user = userEvent.setup();
		renderEditor();

		await user.click(screen.getByRole("button", { name: "Editar" }));

		expect(screen.getByRole("textbox", { name: "Conteúdo Markdown" })).toBeTruthy();
		expect(screen.getByText("Preview")).toBeTruthy();
	});

	it("edits content and displays the unsaved indicator", async () => {
		const user = userEvent.setup();
		renderEditor();
		await user.click(screen.getByRole("button", { name: "Editar" }));

		const editor = screen.getByRole("textbox", { name: "Conteúdo Markdown" });
		await user.clear(editor);
		await user.type(editor, "# Novo");

		expect(editor).toHaveProperty("value", "# Novo");
		expect(screen.getByRole("status", { name: "Alterações não salvas" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Salvar" })).not.toHaveProperty("disabled", true);
	});

	it("saves edited content and returns to read mode", async () => {
		const user = userEvent.setup();
		const { onSave } = renderEditor();
		await user.click(screen.getByRole("button", { name: "Editar" }));
		const editor = screen.getByRole("textbox", { name: "Conteúdo Markdown" });
		await user.clear(editor);
		await user.type(editor, "# Salvo");

		await user.click(screen.getByRole("button", { name: "Salvar" }));

		await waitFor(() => expect(onSave).toHaveBeenCalledWith("# Salvo"));
		expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
	});

	it("confirms cancellation and restores initial content", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		renderEditor();
		await user.click(screen.getByRole("button", { name: "Editar" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Conteúdo Markdown" }), {
			target: { value: "# Alterado" },
		});

		await user.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(confirm).toHaveBeenCalledOnce();
		expect(screen.getByText("Conteúdo inicial")).toBeTruthy();
	});

	it("keeps edit mode when cancellation is rejected", async () => {
		const user = userEvent.setup();
		vi.spyOn(window, "confirm").mockReturnValue(false);
		renderEditor();
		await user.click(screen.getByRole("button", { name: "Editar" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Conteúdo Markdown" }), {
			target: { value: "# Alterado" },
		});

		await user.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(screen.getByRole("textbox", { name: "Conteúdo Markdown" })).toHaveProperty("value", "# Alterado");
	});
});
