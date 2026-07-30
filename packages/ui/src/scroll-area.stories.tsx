import "./index.css";
import { ScrollArea, ScrollAreaViewport } from "./scroll-area";

export const Default = () => (
	<div className="h-[150px] w-[300px] rounded-[var(--radius-sm)] border border-[var(--border)]">
		<ScrollArea className="h-full">
			<ScrollAreaViewport>
				<div className="flex flex-col gap-[var(--space-2)] p-[var(--space-3)] text-[13px]">
					{Array.from({ length: 20 }, (_, i) => (
						<div key={i} className="rounded-[var(--radius-xs)] bg-[var(--muted)] p-[var(--space-2)]">
							Item {i + 1}
						</div>
					))}
				</div>
			</ScrollAreaViewport>
		</ScrollArea>
	</div>
);

export default {
	title: "Components/ScrollArea",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Scrollable content primitive for bounded panels. Prefer it when overflow should remain inside the current supervision surface.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-border", "muted", "radius-sm", "space-3"],
			consumes: [],
			surfaces: ["FlowView", "ExecutionView", "ContextView"],
			a11y: ["bounded-region", "keyboard-scroll"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
