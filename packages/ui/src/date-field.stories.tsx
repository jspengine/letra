import "./index.css";
import { DateField } from "./date-field";

export const Default = () => (
	<div className="w-full max-w-[320px]">
		<DateField
			label="Decision date"
			defaultValue="2026-07-15"
			description="Use local workspace date."
		/>
	</div>
);

export const Invalid = () => (
	<div className="w-full max-w-[320px]">
		<DateField
			label="Decision date"
			defaultValue="2026-07-10"
			error="Date must be inside the active release window."
		/>
	</div>
);

export default {
	title: "Components/DateField",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"DS date input composed from Field primitives and Input, with built-in label, description and error wiring.",
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
