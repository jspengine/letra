import { Icon } from "../icon";
import { Sidebar } from "./sidebar";

const items = [
	{ label: "Home", icon: <Icon name="home" size={16} />, active: true },
	{ label: "Flow", icon: <Icon name="flow" size={16} /> },
	{ label: "Execution", icon: <Icon name="activity" size={16} /> },
	{ label: "Settings", icon: <Icon name="settings-2" size={16} /> },
];

export const Default = () => <Sidebar items={items} />;
export const Collapsed = () => <Sidebar collapsed items={items} />;
export const Empty = () => <Sidebar items={[]} />;
export const Loading = () => (
	<Sidebar
		items={[
			{ label: "Loading workspace", icon: <Icon name="loader-circle" size={16} /> },
			{ label: "Loading flow", icon: <Icon name="loader-circle" size={16} /> },
		]}
	/>
);
export const Error = () => (
	<Sidebar
		items={[
			{
				label: "Workspace unavailable",
				icon: <Icon name="octagon-alert" size={16} />,
				active: true,
			},
			{ label: "Retry sync", icon: <Icon name="activity" size={16} /> },
		]}
	/>
);
export const Mobile = () => (
	<div className="w-[360px]">
		<Sidebar items={items.slice(0, 3)} />
	</div>
);

export default {
	title: "Patterns/Sidebar",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-bg-surface", "color-bg-sunken", "surface-hover", "sidebar-width"],
			consumes: ["Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "ContextView", "SpecsView"],
			a11y: ["button-labels", "focus-visible", "collapsed-labels-hidden", "mobile-width"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
