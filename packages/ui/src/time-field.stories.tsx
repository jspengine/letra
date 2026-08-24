import "./index.css";
import { TimeField } from "./time-field";

export const Default = () => (
	<div className="w-full max-w-[320px]">
		<TimeField
			label="Review time"
			defaultValue="14:00"
			description="Local time for the workspace reviewer."
		/>
	</div>
);

export const Invalid = () => (
	<div className="w-full max-w-[320px]">
		<TimeField
			label="Review time"
			defaultValue="02:00"
			error="Choose a time inside the review window."
		/>
	</div>
);

export default {
	title: "Components/TimeField",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"DS time input composed from Field primitives and Input, with consistent validation wiring.",
			},
		},
		"x-ds": {
			category: "form",
			status: "ready",
			tokens: ["color-border", "focus-ring-color", "radius-md"],
			consumes: ["Field", "Input"],
			surfaces: ["WorkspaceView", "SpecsView"],
			a11y: ["label", "aria-invalid", "aria-describedby"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
