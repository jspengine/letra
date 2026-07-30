import "./index.css";
import { Button } from "./button";
import { Icon } from "./icon";

export const Primary = () => <Button>Approve gate</Button>;
export const Secondary = () => <Button variant="secondary">Review context</Button>;
export const Danger = () => <Button variant="danger">Stop agent</Button>;
export const Ghost = () => <Button variant="ghost">Open logs</Button>;
export const Small = () => <Button size="sm">Claim item</Button>;
export const Loading = () => <Button loading>Validating</Button>;
export const Disabled = () => <Button disabled>Awaiting evidence</Button>;
export const WithIcon = () => (
	<Button>
		<Icon name="zap" size={14} />
		Run checks
	</Button>
);

export default {
	title: "Components/Button",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Primary command primitive for agent and workflow actions. Use one primary action per cluster, keep loading controls disabled, and preserve visible focus for keyboard review flows.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-primary", "color-primary-hover", "color-danger", "duration-fast", "ease-standard"],
			consumes: ["Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView"],
			a11y: ["focus-visible", "disabled-state", "loading-disabled"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
