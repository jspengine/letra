import "./index.css";
import { Timeline, TimelineBranch, TimelineNode } from "./timeline";
import { Icon } from "./icon";

export const Default = () => (
	<Timeline>
		<TimelineNode title="Spec reviewed" description="Reviewer confirmed AC coverage." status="success" />
		<TimelineNode title="Agent running" description="Validation command is executing." status="agent" icon={<Icon name="cpu" size={14} />} />
		<TimelineNode title="Gate pending" description="Human approval required." status="active">
			<TimelineBranch>
				<div className="text-caption text-[var(--color-text-secondary)]">Security reviewer assigned.</div>
			</TimelineBranch>
		</TimelineNode>
		<TimelineNode title="Done" description="Transition completed." last />
	</Timeline>
);

export default {
	title: "Components/Timeline",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Event sequence primitive for operational evidence. Use it to show ordered state changes with clear titles and short descriptions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-agent", "color-success", "color-border", "space-3"],
			consumes: ["Icon"],
			surfaces: ["ExecutionView", "FlowView", "HomeView"],
			a11y: ["ordered-events", "state-not-color-only", "readable-labels"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
