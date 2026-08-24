import "./index.css";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

export const Default = () => (
	<RadioGroup defaultValue="option-1">
		<Label className="flex cursor-pointer items-center gap-[var(--space-2)] text-sm">
			<RadioGroupItem value="option-1" />
			Option A
		</Label>
		<Label className="flex cursor-pointer items-center gap-[var(--space-2)] text-sm">
			<RadioGroupItem value="option-2" />
			Option B
		</Label>
		<Label className="flex cursor-pointer items-center gap-[var(--space-2)] text-sm">
			<RadioGroupItem value="option-3" />
			Option C
		</Label>
	</RadioGroup>
);

export default {
	title: "Components/RadioGroup",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Single-choice input primitive for mutually exclusive options. Use labels for every item and keep option text short enough to scan.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-border", "color-text-primary", "focus-ring-color"],
			consumes: ["Label"],
			surfaces: ["WorkspacesView", "SpecsView"],
			a11y: [
				"radiogroup-semantics",
				"label-associated",
				"keyboard-navigation",
				"focus-visible",
			],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
