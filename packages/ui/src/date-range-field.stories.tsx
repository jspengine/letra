import "./index.css";
import { DateRangeField } from "./date-range-field";

export const Default = () => (
	<div className="w-full max-w-[520px]">
		<DateRangeField
			label="Evidence window"
			description="Select the range used to collect release evidence."
			startProps={{ defaultValue: "2026-07-14" }}
			endProps={{ defaultValue: "2026-07-15" }}
		/>
	</div>
);

export const Invalid = () => (
	<div className="w-full max-w-[520px]">
		<DateRangeField
			label="Evidence window"
			error="End date must be after start date."
			startProps={{ defaultValue: "2026-07-20" }}
			endProps={{ defaultValue: "2026-07-15" }}
		/>
	</div>
);

export default {
	title: "Components/DateRangeField",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component: "Range date field with two DS date inputs, shared labeling and shared validation state.",
			},
		},
		"x-ds": {
			category: "form",
			status: "ready",
			tokens: ["color-border", "focus-ring-color", "space-3", "radius-md"],
			consumes: ["Field", "Input"],
			surfaces: ["WorkspaceView", "SpecsView"],
			a11y: ["label", "aria-invalid", "aria-describedby"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
