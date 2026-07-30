import "./index.css";
import { Button } from "./button";
import { ToastProvider, useToast } from "./toast";

function ToastDemo() {
	const { toast, toastWithOptions } = useToast();
	return (
		<div className="flex flex-wrap gap-[var(--space-2)]">
			<Button onClick={() => toast("Execution completed", "success")}>Success toast</Button>
			<Button onClick={() => toast("Pipeline failed", "error")}>Error toast</Button>
			<Button onClick={() => toast("Telemetry updated", "info")}>Info toast</Button>
			<Button onClick={() => toast("agent-triage-01 updated context", "agent")}>Agent toast</Button>
			<Button
				variant="secondary"
				onClick={() =>
					toastWithOptions("Security gate needs review", {
						type: "error",
						action: { label: "Open", onClick: () => undefined },
					})
				}
			>
				With action
			</Button>
		</div>
	);
}

export const AllVariants = () => (
	<ToastProvider>
		<ToastDemo />
	</ToastProvider>
);

export default {
	title: "Components/Toast",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Transient feedback primitive for workflow events and agent updates. Toasts should be concise, include action buttons only when useful, and not replace persistent error state.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-success", "color-danger", "color-info", "color-agent", "shadow-lg"],
			consumes: ["Button", "Icon"],
			surfaces: ["HomeView", "ExecutionView", "FlowView"],
			a11y: ["icon-and-label", "action-button"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
