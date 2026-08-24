import { Button } from "../button";
import { SkeletonCard } from "../skeleton";
import { GateCard } from "./gate-card";

export const Default = () => (
	<GateCard
		title="Release gate"
		description="Checks are running before review."
		status="waiting"
		urgency="medium"
	/>
);
export const Waiting = () => (
	<GateCard
		title="Release gate"
		description="Checks are running before review."
		status="waiting"
		urgency="medium"
	/>
);
export const Available = () => (
	<GateCard
		title="Human approval"
		description="Evidence is ready for review."
		status="available"
		urgency="high"
		action={<Button size="sm">Approve</Button>}
	/>
);
export const CriticalBlocked = () => (
	<GateCard
		title="Security gate"
		description="SAST returned critical findings."
		status="blocked"
		urgency="critical"
	/>
);
export const Approved = () => (
	<GateCard title="Lint gate" description="No issues found." status="approved" urgency="low" />
);
export const Empty = () => (
	<GateCard
		title="No gates pending"
		description="The current item has no human approval gates."
		status="approved"
		urgency="low"
	/>
);
export const Loading = () => <SkeletonCard />;
export const Error = () => (
	<GateCard
		title="Gate evidence unavailable"
		description="Validation output could not be loaded."
		status="blocked"
		urgency="critical"
	/>
);
export const Collapsed = () => (
	<GateCard title="Security gate" status="blocked" urgency="critical" />
);
export const Mobile = () => (
	<div className="w-[360px]">
		<Available />
	</div>
);

export default {
	title: "Patterns/GateCard",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: [
				"color-primary",
				"color-warning",
				"color-success",
				"color-danger",
				"color-border",
			],
			consumes: ["Badge", "Button", "SkeletonCard"],
			surfaces: ["HomeView", "FlowView"],
			a11y: ["status-labels", "color-plus-text"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
