import "./index.css";
import { AgentStatusIndicator } from "./agent-status-indicator";

export const States = () => (
	<div className="flex flex-col gap-[var(--space-3)]">
		<AgentStatusIndicator state="idle" showLabel />
		<AgentStatusIndicator state="thinking" showLabel />
		<AgentStatusIndicator state="running" showLabel />
		<AgentStatusIndicator state="error" showLabel />
		<AgentStatusIndicator state="done" showLabel />
	</div>
);

export const DotOnly = () => (
	<div className="flex items-center gap-[var(--space-3)]">
		<AgentStatusIndicator state="idle" />
		<AgentStatusIndicator state="thinking" />
		<AgentStatusIndicator state="running" />
		<AgentStatusIndicator state="error" />
		<AgentStatusIndicator state="done" />
	</div>
);

export default {
	title: "Components/AgentStatusIndicator",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Agent status indicator for compact execution state. Use showLabel when the state is decision-relevant.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"color-agent",
				"color-danger",
				"color-success",
				"color-text-disabled",
				"motion-base",
			],
			consumes: ["Tooltip"],
			surfaces: ["ExecutionView", "HomeView"],
			a11y: ["tooltip-label", "state-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
