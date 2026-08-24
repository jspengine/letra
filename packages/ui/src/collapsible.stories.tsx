import "./index.css";
import { Card, CardContent } from "./card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

export const Default = () => (
	<Collapsible>
		<CollapsibleTrigger className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-[var(--space-3)] text-xs font-medium text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]">
			Toggle details
		</CollapsibleTrigger>
		<CollapsibleContent>
			<Card className="mt-[var(--space-2)] max-w-sm">
				<CardContent>
					Additional details revealed here. This panel can be toggled open and closed.
				</CardContent>
			</Card>
		</CollapsibleContent>
	</Collapsible>
);

export default {
	title: "Components/Collapsible",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Lightweight disclosure primitive for optional detail inside an existing surface. Prefer Accordion when several related sections need the same treatment.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["duration-fast", "ease-standard", "radius-md", "color-border"],
			consumes: ["Card"],
			surfaces: ["ContextView", "SpecsView"],
			a11y: ["button-trigger", "expanded-state", "keyboard-navigation"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
