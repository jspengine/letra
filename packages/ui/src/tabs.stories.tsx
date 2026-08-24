import "./index.css";
import { Tabs } from "./tabs";

const tabs = [
	{ id: "active", label: "Active" },
	{ id: "inactive", label: "Inactive" },
	{ id: "disabled", label: "Disabled", disabled: true },
];

export const Default = () => <Tabs tabs={tabs} activeTab="active" onChange={() => {}} />;

export const SecondActive = () => <Tabs tabs={tabs} activeTab="inactive" onChange={() => {}} />;

export default {
	title: "Components/Tabs",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Segmented navigation primitive for switching related views without leaving the current supervision context. Use disabled tabs only when the unavailable reason is visible nearby.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-border", "color-text-primary", "space-3"],
			consumes: [],
			surfaces: ["ContextView", "SpecsView", "FlowView"],
			a11y: ["tablist-semantics", "keyboard-navigation", "disabled-state", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
