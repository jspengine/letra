import "./index.css";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export const Default = () => (
	<Popover>
		{({ setOpen }) => (
			<>
				<PopoverTrigger asChild onClick={() => setOpen(true)}>
					<Button variant="secondary" size="sm">
						Open popover
					</Button>
				</PopoverTrigger>
				<PopoverContent>
					<div className="mb-[var(--space-1)] text-sm font-medium">Notifications</div>
					<div className="text-xs text-muted-foreground">You have 3 unread messages.</div>
				</PopoverContent>
			</>
		)}
	</Popover>
);

export default {
	title: "Components/Popover",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Small contextual overlay for supplemental content. Use Dialog or Sheet when the interaction requires a focused task or persistent details.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["card", "color-border", "shadow-md", "radius-md", "space-4"],
			consumes: ["Button"],
			surfaces: ["HomeView", "FlowView", "SpecsView"],
			a11y: ["trigger-associated", "dismissible", "keyboard-navigation"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
