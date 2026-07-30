import "./index.css";
import { Sparkline } from "./sparkline";

export const Default = () => <Sparkline data={[8, 12, 9, 16, 14, 22, 19]} />;
export const Success = () => <Sparkline data={[2, 4, 8, 12, 18, 24]} color="var(--color-success)" />;

export default {
	title: "Components/Sparkline",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact trend primitive for small metrics. Pair with visible numeric values when precision matters.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-success"],
			consumes: [],
			surfaces: ["HomeView", "ExecutionView"],
			a11y: ["decorative-trend", "requires-visible-value"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
