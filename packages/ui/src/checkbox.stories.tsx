import "./index.css";
import { Checkbox } from "./checkbox";

export const Unchecked = () => <Checkbox label="Enable notifications" />;
export const Checked = () => <Checkbox label="Enable notifications" defaultChecked />;
export const Disabled = () => <Checkbox label="Option locked" disabled />;
export const DisabledChecked = () => <Checkbox label="Option locked" disabled defaultChecked />;

export default {
	title: "Components/Checkbox",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Binary input primitive for explicit supervisor choices. Use it for independent settings only; option sets should use RadioGroup or Tabs-like controls.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-border", "color-text-secondary", "focus-ring-color"],
			consumes: ["Label"],
			surfaces: ["WorkspacesView", "SpecsView"],
			a11y: ["native-checkbox", "label-associated", "disabled-state", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
