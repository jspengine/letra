import "./index.css";
import { ThroughputMeter } from "./throughput-meter";

export const Default = () => <ThroughputMeter value={64} max={100} label="Checks" showValue />;
export const WithBaseline = () => (
	<ThroughputMeter value={72} max={100} baseline={55} label="Success rate" showValue />
);

export default {
	title: "Components/ThroughputMeter",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact quantitative meter for agent and pipeline throughput. Use baseline only when comparison is meaningful.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-bg-sunken", "color-text-secondary", "duration-fast"],
			consumes: [],
			surfaces: ["HomeView", "ExecutionView"],
			a11y: ["visible-label", "visible-value", "baseline-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
