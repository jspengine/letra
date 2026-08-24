import "./index.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export const Default = () => (
	<Select defaultValue="review">
		<SelectTrigger className="w-[220px]">
			<SelectValue>Review</SelectValue>
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="design">Design</SelectItem>
			<SelectItem value="code">Code</SelectItem>
			<SelectItem value="review">Review</SelectItem>
			<SelectItem value="security">Security</SelectItem>
		</SelectContent>
	</Select>
);

export const WithPlaceholder = () => (
	<Select>
		<SelectTrigger className="w-[220px]" placeholder="Choose next stage..." />
		<SelectContent>
			<SelectItem value="review">Review</SelectItem>
			<SelectItem value="security">Security</SelectItem>
			<SelectItem value="done">Done</SelectItem>
		</SelectContent>
	</Select>
);

export default {
	title: "Components/Select",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Option selection primitive for bounded workflow choices. Keep option labels short, expose selected state to assistive tech, and preserve Escape/keyboard navigation.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-bg-sunken", "color-primary", "color-border"],
			consumes: ["Icon"],
			surfaces: ["FlowView", "SpecsView", "WorkspacesView"],
			a11y: ["keyboard-escape", "aria-selected", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
