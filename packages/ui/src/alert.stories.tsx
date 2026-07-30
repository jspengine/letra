import "./index.css";
import { Alert } from "./alert";

export const Info = () => <Alert variant="info">Telemetry connected successfully.</Alert>;

export const Success = () => (
	<Alert variant="success" title="Pipeline completed">
		Onboarding finished in 12s.
	</Alert>
);

export const Warning = () => (
	<Alert variant="warning" title="3 active alerts">
		Check the dashboard for details.
	</Alert>
);

export const Error = () => (
	<Alert variant="error" title="Connection failed">
		Could not connect to the MCP server.
	</Alert>
);

export default {
	title: "Components/Alert",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Inline feedback primitive for non-blocking health, validation, and system messages. Use title when the alert needs to be scanned independently.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-info", "color-success", "color-warning", "color-danger", "color-text-primary"],
			consumes: ["Icon"],
			surfaces: ["HomeView", "FlowView", "WorkspacesView"],
			a11y: ["semantic-message", "state-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
