import "./index.css";
import { GlassPanel } from "./glass-panel";

export const Default = () => (
	<GlassPanel className="max-w-sm p-[var(--space-4)]">
		<div className="text-sm font-medium">Supervisor panel</div>
		<p className="mt-[var(--space-2)] text-sm text-[var(--color-text-secondary)]">
			Transparent surface for elevated context.
		</p>
	</GlassPanel>
);

export const Agent = () => (
	<GlassPanel variant="agent" radius="lg" className="max-w-sm p-[var(--space-4)]">
		<div className="text-sm font-medium">Agent activity</div>
	</GlassPanel>
);

export default {
	title: "Components/GlassPanel",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Elevated translucent panel for dense supervision context. Use sparingly where depth communicates layering, not decoration.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "color-agent", "shadow-lg", "radius-md"],
			consumes: [],
			surfaces: ["HomeView", "ExecutionView"],
			a11y: ["sufficient-contrast", "non-decorative-surface"],
			breakpoints: ["desktop"],
		},
	},
};
