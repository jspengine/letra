import "./index.css";
import { Input } from "./input";
import { Label } from "./label";

export const Default = () => <Label>Email address</Label>;

export const WithInput = () => (
	<div className="flex max-w-[320px] flex-col gap-[var(--space-2)]">
		<Label htmlFor="email">Email address</Label>
		<Input id="email" type="email" placeholder="you@example.com" />
	</div>
);

export default {
	title: "Components/Label",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Text label primitive for form controls and settings. Pair labels with concrete control ids whenever the control is interactive.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-text-primary", "space-2"],
			consumes: ["Input"],
			surfaces: ["ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["label-associated", "readable-text"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
