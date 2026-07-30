import { Badge } from "../badge";
import { Icon } from "../icon";
import { SkeletonAgentList } from "../skeleton";
import { ActivityTimeline, TimelineItem } from "./activity-timeline";

export const Default = () => (
	<ActivityTimeline className="w-full max-w-md">
		<TimelineItem title="Deploy started" description="Pipeline 142 entered execution." timestamp="2 min ago" status="info" icon={<Icon name="info" size={16} />} />
		<TimelineItem title="Tests passed" description="Unit and integration passed." timestamp="1 min ago" status="success" icon={<Icon name="circle-check" size={16} />} />
		<TimelineItem title="Build failed" description="SAST returned 2 critical findings." timestamp="now" status="error" icon={<Icon name="circle-x" size={16} />} action={<Badge variant="error">error</Badge>} />
	</ActivityTimeline>
);

export const AgentOnly = () => (
	<ActivityTimeline className="w-full max-w-md">
		<TimelineItem title="Agent triage" description="Agent started classification." timestamp="3 min ago" status="agent" icon={<Icon name="bot" size={16} />} last />
	</ActivityTimeline>
);

export const Empty = () => <ActivityTimeline className="w-full max-w-md">{null}</ActivityTimeline>;
export const Loading = () => <SkeletonAgentList />;
export const Error = () => (
	<ActivityTimeline className="w-full max-w-md">
		<TimelineItem title="Timeline unavailable" description="Activity stream could not be loaded." timestamp="now" status="error" icon={<Icon name="circle-x" size={16} />} last />
	</ActivityTimeline>
);
export const Collapsed = () => (
	<ActivityTimeline className="w-20">
		<TimelineItem title="Agent" status="agent" icon={<Icon name="bot" size={16} />} last />
	</ActivityTimeline>
);
export const Mobile = () => (
	<div className="w-[360px]">
		<Default />
	</div>
);

export default {
	title: "Patterns/ActivityTimeline",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-info", "color-success", "color-danger", "color-agent", "color-border"],
			consumes: ["Badge", "Icon", "SkeletonAgentList"],
			surfaces: ["HomeView", "FlowView", "ExecutionView"],
			a11y: ["icon-and-label", "timestamp-text"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
