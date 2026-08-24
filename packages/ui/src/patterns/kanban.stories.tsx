import { Badge } from "../badge";
import { SkeletonCard } from "../skeleton";
import { KanbanBoard, KanbanItem } from "./kanban";

export const Default = () => (
	<KanbanBoard
		columns={[
			{
				id: "todo",
				title: "To do",
				children: [
					<KanbanItem
						key="1"
						title="Refactor flow-serve"
						subtitle="Tech debt"
						tag={<Badge variant="info">info</Badge>}
					/>,
					<KanbanItem
						key="2"
						title="MCP tests"
						subtitle="Pending evidence"
						tag={<Badge variant="amber">waiting</Badge>}
					/>,
				],
			},
			{
				id: "done",
				title: "Done",
				children: [
					<KanbanItem
						key="3"
						title="Tokens DS v2"
						subtitle="Today"
						tag={<Badge variant="success">done</Badge>}
					/>,
				],
			},
		]}
	/>
);

export const Empty = () => (
	<KanbanBoard
		columns={[
			{ id: "todo", title: "To do", children: null },
			{ id: "review", title: "Review", children: null },
			{ id: "done", title: "Done", children: null },
		]}
	/>
);

export const Error = () => (
	<KanbanBoard
		columns={[
			{
				id: "blocked",
				title: "Blocked",
				children: [
					<KanbanItem
						key="1"
						title="Security gate failed"
						subtitle="Needs human review"
						tag={<Badge variant="error">blocked</Badge>}
					/>,
				],
			},
		]}
	/>
);
export const Loading = () => (
	<KanbanBoard
		columns={[
			{ id: "todo", title: "To do", children: <SkeletonCard /> },
			{ id: "review", title: "Review", children: <SkeletonCard /> },
			{ id: "done", title: "Done", children: <SkeletonCard /> },
		]}
	/>
);
export const Collapsed = () => (
	<KanbanBoard
		columns={[
			{
				id: "code",
				title: "Code",
				children: (
					<KanbanItem
						title="ITEM-76"
						subtitle="3/8 ACs complete"
						tag={<Badge variant="agent">agent</Badge>}
					/>
				),
			},
		]}
	/>
);
export const Mobile = () => (
	<div className="w-[360px]">
		<Default />
	</div>
);

export default {
	title: "Patterns/KanbanBoard",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-bg-surface", "color-bg-base", "color-border", "surface-hover"],
			consumes: ["Badge", "SkeletonCard"],
			surfaces: ["FlowView"],
			a11y: ["button-card", "horizontal-scroll"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
