import "./index.css";
import { Badge } from "./badge";

export const Amber = () => <Badge variant="amber">waiting approval</Badge>;
export const Success = () => <Badge variant="success">checks passed</Badge>;
export const Info = () => <Badge variant="info">telemetry</Badge>;
export const Error = () => <Badge variant="error">blocked</Badge>;
export const Agent = () => <Badge variant="agent">agent update</Badge>;
export const Count = () => <Badge variant="info">3 alerts</Badge>;

export default {
	title: "Components/Badge",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact status primitive for workflow, health, and agent signals. Color must be paired with text or icon semantics; reserve the agent variant for agent-originated state only.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-success", "color-info", "color-danger", "color-agent"],
			consumes: ["Icon"],
			surfaces: ["FlowView", "ExecutionView", "WorkspacesView"],
			a11y: ["icon-and-label", "semantic-color-with-text"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
