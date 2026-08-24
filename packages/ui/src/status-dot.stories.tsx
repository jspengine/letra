import "./index.css";
import { StatusDot } from "./status-dot";

export const Colors = () => (
	<div className="flex items-center gap-[var(--space-3)]">
		<StatusDot color="primary" label="Primary" />
		<StatusDot color="success" label="Success" />
		<StatusDot color="danger" label="Danger" />
		<StatusDot color="warning" label="Warning" />
		<StatusDot color="info" label="Info" />
		<StatusDot color="agent" label="Agent" />
		<StatusDot color="disabled" label="Disabled" />
	</div>
);

export const Pulsing = () => <StatusDot color="primary" pulse label="Running" />;

export default {
	title: "Components/StatusDot",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Small status marker primitive. Use labels or adjacent text when the status changes user decisions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"color-primary",
				"color-success",
				"color-danger",
				"color-warning",
				"color-info",
				"color-agent",
			],
			consumes: ["Tooltip"],
			surfaces: ["HomeView", "ExecutionView", "FlowView"],
			a11y: ["tooltip-label", "state-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
