import { Progress } from "./progress";

export const Default = () => <Progress value={45} label="Upload" showValue />;

export const Complete = () => <Progress value={100} state="complete" label="Sincronizado" showValue />;

export const Warning = () => <Progress value={70} state="warning" label="Armazenamento" showValue />;

export const Error = () => <Progress value={25} state="error" label="Download" showValue />;

export const Active = () => <Progress value={60} state="active" label="Executando" showValue />;

export const Agent = () => <Progress value={35} state="agent" label="Agente raciocinando" showValue />;

export const Indeterminate = () => <Progress value={100} state="active" label="Validando" indeterminate />;

export const Sizes = () => (
	<div className="flex flex-col gap-[var(--space-2)]">
		<Progress value={80} size="xs" label="xs" />
		<Progress value={80} size="sm" label="sm" />
		<Progress value={80} size="md" label="md" />
	</div>
);

export default {
	title: "Components/Progress",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Progress feedback primitive for finite operations and validation state. Pair numeric progress with a label when the user needs operational evidence.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-agent", "color-success", "color-warning", "color-danger", "color-bg-sunken", "progress-stripes"],
			consumes: [],
			surfaces: ["HomeView", "ExecutionView", "WorkspacesView"],
			a11y: ["progressbar-semantics", "label-visible", "state-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
