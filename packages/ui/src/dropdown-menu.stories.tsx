import "./index.css";
import { useState } from "react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";

export const Default = () => {
	const [open, setOpen] = useState(false);
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button>Actions</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>Manage</DropdownMenuLabel>
				<DropdownMenuItem onClick={() => alert("Run")}>Run</DropdownMenuItem>
				<DropdownMenuItem onClick={() => alert("Duplicate")}>Duplicate</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-[var(--color-danger)]"
					onClick={() => alert("Delete")}
				>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default {
	title: "Components/DropdownMenu",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Contextual action menu for secondary commands. Keep destructive actions separated and clearly labelled.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["card", "color-border", "color-danger", "shadow-md", "radius-md"],
			consumes: ["Button"],
			surfaces: ["FlowView", "ExecutionView", "WorkspacesView"],
			a11y: ["menu-semantics", "keyboard-navigation", "dismissible", "destructive-labelled"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
