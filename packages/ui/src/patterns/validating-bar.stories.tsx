import { ValidatingBar } from "./validating-bar";

export const Default = () => <ValidatingBar className="w-96" />;
export const CustomLabel = () => <ValidatingBar className="w-96" label="Running ds:validate..." />;
export const Empty = () => <ValidatingBar className="w-96 border-dashed" label="No validation running" />;
export const Loading = () => <ValidatingBar className="w-96" label="Building Storybook..." />;
export const Error = () => <ValidatingBar className="w-96" label="Validation failed" />;
export const Collapsed = () => <ValidatingBar className="w-48" label="Validating" />;
export const Mobile = () => (
	<div className="w-[360px]">
		<ValidatingBar label="Running checks..." />
	</div>
);

export default {
	title: "Patterns/ValidatingBar",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-primary", "color-bg-surface", "color-bg-sunken", "validating-bar", "motion-base"],
			consumes: [],
			surfaces: ["FlowView", "SpecsView", "WorkspacesView"],
			a11y: ["aria-live"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
