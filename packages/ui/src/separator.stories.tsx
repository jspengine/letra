import "./index.css";
import { Separator } from "./separator";

export const Horizontal = () => (
	<div className="flex w-[200px] flex-col gap-[var(--space-3)] text-sm">
		<div>Above</div>
		<Separator />
		<div>Below</div>
	</div>
);

export const Vertical = () => (
	<div className="flex h-10 items-center gap-[var(--space-3)] text-sm">
		<span>Left</span>
		<Separator orientation="vertical" />
		<span>Center</span>
		<Separator orientation="vertical" />
		<span>Right</span>
	</div>
);

export default {
	title: "Components/Separator",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Structural divider primitive. Use it to separate related groups without creating a new surface or nested card.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-border", "border-thin"],
			consumes: [],
			surfaces: ["ContextView", "SpecsView", "FlowView"],
			a11y: ["decorative-divider", "orientation"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
