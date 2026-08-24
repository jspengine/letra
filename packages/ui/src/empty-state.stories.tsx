import "./index.css";
import { EmptyState } from "./empty-state";
import { Button } from "./button";
import { Icon } from "./icon";

export const Basic = () => (
	<EmptyState
		title="No active agents"
		description="Create your first agent to start orchestrating pipelines."
	/>
);

export const WithAction = () => (
	<EmptyState
		title="No active agents"
		description="Create your first agent to start orchestrating pipelines."
		action={<Button size="sm">Create agent</Button>}
	/>
);

export const WithIcon = () => (
	<EmptyState
		icon={<Icon name="bot" size={24} />}
		title="No active agents"
		description="Create your first agent to start."
		action={<Button size="sm">Create agent</Button>}
	/>
);

export default {
	title: "Components/EmptyState",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Empty-state primitive for absent data, paused work, and first-run surfaces. Pair the message with one honest next action when action is available.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-text-primary", "color-text-secondary", "space-4"],
			consumes: ["Button", "Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "WorkspacesView"],
			a11y: ["clear-heading", "action-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
