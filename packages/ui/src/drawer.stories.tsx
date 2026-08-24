import "./index.css";
import { useState } from "react";
import { Button } from "./button";
import {
	Drawer,
	DrawerTrigger,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerDescription,
	DrawerFooter,
	DrawerClose,
} from "./drawer";

export const Default = () => {
	const [open, setOpen] = useState(false);
	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<DrawerTrigger className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-[var(--space-4)] text-body-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]">
				Open drawer
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Edit agent</DrawerTitle>
					<DrawerDescription>Make changes to the agent configuration.</DrawerDescription>
				</DrawerHeader>
				<div className="px-[var(--space-4)] py-[var(--space-2)] text-body-sm text-[var(--color-text-primary)]">
					Agent settings content goes here.
				</div>
				<DrawerFooter>
					<DrawerClose className="inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-[var(--space-3)] text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)]">
						Cancel
					</DrawerClose>
					<Button size="sm" onClick={() => setOpen(false)}>
						Save
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
};

export default {
	title: "Components/Drawer",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Bottom overlay primitive for mobile-first detail and edit flows. Drawer content must include an accessible title and keep primary actions in the footer.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["overlay", "card", "card-foreground", "radius-lg", "shadow-xl"],
			consumes: ["Button"],
			surfaces: ["ExecutionView", "FlowView", "WorkspacesView"],
			a11y: ["title-required", "description-optional", "focus-trap", "dismissible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
