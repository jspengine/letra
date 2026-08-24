import "./index.css";
import { Input } from "./input";
import { Textarea } from "./textarea";

export const Default = () => <Input aria-label="Agent name" placeholder="Ex: agent-triage-01" />;
export const WithValue = () => (
	<Input aria-label="Agent name" value="agent-triage-01" onChange={() => {}} />
);
export const Disabled = () => (
	<Input aria-label="Agent name" value="claude-sonnet-5" disabled onChange={() => {}} />
);
export const Invalid = () => (
	<Input aria-label="Workspace slug" value="missing-workspace" aria-invalid onChange={() => {}} />
);

export const TextareaDefault = () => (
	<Textarea placeholder="Describe the expected agent behavior..." />
);

export default {
	title: "Components/Input",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Text entry primitive for filters, names, prompts, and markdown editing. Pair with an accessible label in product surfaces and use aria-invalid for validation state.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-base", "color-border", "focus-ring-color", "duration-fast"],
			consumes: ["Textarea"],
			surfaces: ["ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["focus-visible", "aria-invalid", "disabled-state"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
