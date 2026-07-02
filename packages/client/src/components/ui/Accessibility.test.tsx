import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	Dialog,
	Input,
	Label,
	RadioGroup,
	RadioGroupItem,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@letra/ui";
import { describe, expect, it, vi } from "vitest";
import { NavTabs } from "../NavTabs/NavTabs";
import { DocumentEditor } from "./DocumentEditor";

async function expectNoAccessibilityViolations(container: HTMLElement) {
	const { default: axe } = await import("axe-core");
	const results = await axe.run(container, {
		rules: {
			"color-contrast": { enabled: false },
		},
	});
	expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

describe("accessibility", () => {
	it("audits the DocumentEditor read and edit modes", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<DocumentEditor
				file="context.md"
				initialContent="# Contexto\n\nConteúdo acessível"
				onSave={vi.fn().mockResolvedValue(undefined)}
				title="Contexto"
			/>,
		);

		await expectNoAccessibilityViolations(container);
		await user.click(screen.getByRole("button", { name: "Editar" }));
		await expectNoAccessibilityViolations(container);
	});

	it("supports keyboard navigation in the primary tabs", async () => {
		const user = userEvent.setup();
		const onTabChange = vi.fn();
		const { container } = render(<NavTabs activeTab="home" onTabChange={onTabChange} />);

		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Home" }));
		await user.keyboard("{Enter}");
		expect(onTabChange).toHaveBeenCalledWith("home");

		await expectNoAccessibilityViolations(container);
	});

	it("audits canonical form and table primitives", async () => {
		const { container } = render(
			<div>
				<Label htmlFor="workspace-name">Nome do workspace</Label>
				<Input id="workspace-name" />
				<RadioGroup aria-label="Template" defaultValue="sdlc">
					<Label>
						<RadioGroupItem value="sdlc" />
						SDLC
					</Label>
				</RadioGroup>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Item</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell>ITEM-57</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>,
		);

		await expectNoAccessibilityViolations(container);
	});

	it("audits the fullscreen Dialog and closes it with Escape", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const { container } = render(
			<Dialog open onClose={onClose} title="Detalhes do item" variant="fullscreen">
				<p>Conteúdo do item</p>
			</Dialog>,
		);

		await expectNoAccessibilityViolations(container);
		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalled();
	});
});
