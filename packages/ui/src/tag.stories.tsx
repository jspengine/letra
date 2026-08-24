import "./index.css";
import { Tag } from "./tag";

export const Variants = () => (
	<div className="flex flex-wrap gap-[var(--space-2)]">
		<Tag>default</Tag>
		<Tag variant="agent">agent</Tag>
		<Tag variant="success">success</Tag>
		<Tag variant="info">info</Tag>
		<Tag variant="warning">review</Tag>
		<Tag variant="danger">blocked</Tag>
	</div>
);

export default {
	title: "Components/Tag",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact classification primitive for non-critical metadata. Prefer Badge for workflow status and health state.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"color-agent",
				"color-success",
				"color-info",
				"color-danger",
				"color-border",
				"radius-full",
			],
			consumes: [],
			surfaces: ["FlowView", "ExecutionView", "SpecsView"],
			a11y: ["text-label", "not-status-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
