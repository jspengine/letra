import "./index.css";
import { ErrorBanner } from "./error-banner";

export const Simple = () => (
	<ErrorBanner title="Connection failed">
		Unable to reach the server. Check your network connection.
	</ErrorBanner>
);

export const WithRetry = () => (
	<ErrorBanner title="Sync error" onRetry={() => alert("Retrying...")}>
		Failed to sync workspace data.
	</ErrorBanner>
);

export const WithDetails = () => (
	<ErrorBanner
		title="Validation error"
		details={"Error: ENOENT: no such file or directory, open '.letra/workflow.json'\n    at Object.openSync (node:fs:585:3)\n    at Object.readFileSync (node:fs:453:35)"}
	>
		Could not load workflow configuration.
	</ErrorBanner>
);

export const Full = () => (
	<ErrorBanner title="Deployment failed" details={"Exit code: 1\nError: Build failed with 3 errors."} onRetry={() => alert("Retrying...")}>
		The build process encountered errors. Review the details below.
	</ErrorBanner>
);

export default {
	title: "Components/ErrorBanner",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"High-signal error primitive for recoverable operational failures. Include details only when they help diagnosis, and keep retry actions explicit.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-danger", "color-bg-sunken", "color-border", "font-code"],
			consumes: ["Button", "Icon"],
			surfaces: ["FlowView", "ExecutionView", "WorkspacesView"],
			a11y: ["error-message", "retry-action", "details-readable"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
