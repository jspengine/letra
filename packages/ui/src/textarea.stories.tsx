import "./index.css";
import { Textarea } from "./textarea";

export const Empty = () => (
	<Textarea placeholder="Type your message..." className="max-w-[400px]" />
);
export const WithValue = () => (
	<Textarea defaultValue="This is a sample text." className="max-w-[400px]" />
);
export const Disabled = () => (
	<Textarea disabled value="Disabled content" className="max-w-[400px]" />
);

export default {
	title: "Components/Textarea",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Multiline text primitive for notes, prompts, and evidence capture. Keep it scoped to free-form text and preserve mono/code readability where operational logs are expected.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"color-bg-base",
				"color-border",
				"color-text-primary",
				"focus-ring-color",
				"space-3",
			],
			consumes: [],
			surfaces: ["ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["native-textarea", "disabled-state", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
