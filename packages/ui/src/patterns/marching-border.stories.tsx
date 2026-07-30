import { Card, CardContent } from "../card";
import { Badge } from "../badge";
import { SkeletonCard } from "../skeleton";
import { MarchingBorder } from "./marching-border";

export const ActiveAgent = () => (
	<MarchingBorder containerClassName="w-80">
		<Card>
			<CardContent>
				<div className="flex flex-col gap-[var(--space-1)]">
					<span className="text-body-sm font-medium">agent-triage-01</span>
					<span className="text-caption text-[var(--color-text-secondary)]">Claimed and running</span>
				</div>
			</CardContent>
		</Card>
	</MarchingBorder>
);
export const Default = ActiveAgent;
export const Empty = () => (
	<Card>
		<CardContent>
			<span className="text-body-sm">No claimed item</span>
		</CardContent>
	</Card>
);
export const Loading = () => (
	<MarchingBorder containerClassName="w-80">
		<SkeletonCard />
	</MarchingBorder>
);
export const Error = () => (
	<MarchingBorder containerClassName="w-80">
		<Card>
			<CardContent>
				<div className="flex items-center justify-between gap-[var(--space-3)]">
					<span className="text-body-sm font-medium">Claim lost</span>
					<Badge variant="error">error</Badge>
				</div>
			</CardContent>
		</Card>
	</MarchingBorder>
);
export const Collapsed = () => (
	<MarchingBorder containerClassName="w-32">
		<Card>
			<CardContent>
				<span className="text-caption">ITEM-76</span>
			</CardContent>
		</Card>
	</MarchingBorder>
);
export const Mobile = () => (
	<div className="w-[360px]">
		<ActiveAgent />
	</div>
);

export default {
	title: "Patterns/MarchingBorder",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["live", "radius-md", "dash-march"],
			consumes: ["Badge", "Card", "SkeletonCard"],
			surfaces: ["FlowView", "ExecutionView"],
			a11y: ["decorative-hidden"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
