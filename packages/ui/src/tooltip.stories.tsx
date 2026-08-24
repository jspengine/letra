import "./index.css";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

export const Top = () => (
	<Tooltip content="Run validation before moving the item" position="top">
		<Button variant="secondary">Validate</Button>
	</Tooltip>
);
export const Bottom = () => (
	<Tooltip content="Open the activity evidence" position="bottom">
		<Button variant="secondary">Evidence</Button>
	</Tooltip>
);
export const Left = () => (
	<Tooltip content="Agent is reasoning" position="left">
		<Button variant="secondary">Agent</Button>
	</Tooltip>
);
export const Right = () => (
	<Tooltip content="Workspace has active alerts" position="right">
		<Button variant="secondary">Health</Button>
	</Tooltip>
);

export default {
	title: "Components/Tooltip",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Supplemental explanation primitive for compact controls and status hints. Tooltips must be available on hover and focus and should not carry essential workflow instructions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["foreground", "background", "radius-sm"],
			consumes: ["Button"],
			surfaces: ["HomeView", "FlowView", "ExecutionView"],
			a11y: ["hover", "focus", "role-tooltip"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
