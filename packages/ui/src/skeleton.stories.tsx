import "./index.css";
import { Skeleton, SkeletonAgentList, SkeletonCard, SkeletonKanban, SkeletonPipeline, SkeletonTable } from "./skeleton";

export const Base = () => (
	<div className="flex flex-col gap-[var(--space-2)]">
		<Skeleton className="h-4 w-48" />
		<Skeleton className="h-4 w-32" />
		<Skeleton className="h-4 w-64" />
	</div>
);

export const Card = () => (
	<div className="grid grid-cols-3 gap-[var(--space-3)]">
		<SkeletonCard />
		<SkeletonCard />
		<SkeletonCard />
	</div>
);

export const Pipeline = () => <SkeletonPipeline />;
export const Table = () => <SkeletonTable />;
export const AgentList = () => <SkeletonAgentList />;
export const Kanban = () => <SkeletonKanban />;

export default {
	title: "Components/Skeleton",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Loading placeholder primitive for pending data and optimistic layout stability. Match skeleton shape to the final content block.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["muted", "card", "color-border", "radius-md", "space-3", "shimmer-slide"],
			consumes: [],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "WorkspacesView"],
			a11y: ["decorative-loading", "layout-stability"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
