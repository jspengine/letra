import "./index.css";
import { Button } from "./button";
import { DriftIndicator } from "./drift-indicator";

export const Default = () => <DriftIndicator message="Spec and implementation drift detected" />;

export const WithAction = () => (
	<DriftIndicator
		message="Acceptance criteria changed after implementation"
		action={<Button size="sm" variant="secondary">Review diff</Button>}
	/>
);

export default {
	title: "Components/DriftIndicator",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Operational warning primitive for spec/code drift. Use it only for actionable divergence that changes supervision decisions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-warning", "color-text-primary", "duration-fast"],
			consumes: ["Button"],
			surfaces: ["FlowView", "SpecsView"],
			a11y: ["alert-role", "action-visible", "dismissible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
