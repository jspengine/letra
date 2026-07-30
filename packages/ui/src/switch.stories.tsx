import "./index.css";
import { Switch } from "./switch";

export const Off = () => <Switch />;
export const On = () => <Switch defaultChecked />;
export const Small = () => <Switch size="sm" />;
export const SmallOn = () => <Switch size="sm" defaultChecked />;
export const Disabled = () => <Switch disabled />;

export default {
	title: "Components/Switch",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Binary setting primitive for immediate on/off preferences. Use Checkbox when the control belongs inside a form or checklist.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-input", "focus-ring-color", "duration-fast"],
			consumes: [],
			surfaces: ["WorkspacesView", "ContextView"],
			a11y: ["switch-semantics", "checked-state", "disabled-state", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
