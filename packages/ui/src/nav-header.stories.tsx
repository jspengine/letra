import "./index.css";
import { Button } from "./button";
import { Badge } from "./badge";
import { Icon } from "./icon";
import { NavHeader } from "./nav-header";

export const Default = () => (
	<NavHeader
		title="Workspace"
		description="letra/workspace"
		right={
			<Button variant="ghost" size="sm">
				Settings
			</Button>
		}
	/>
);

export const WithLeftAction = () => (
	<NavHeader
		title="Items"
		description="flow-1"
		left={
			<Button variant="ghost" size="sm">
				<Icon name="chevron-left" size={14} />
				Back
			</Button>
		}
		right={
			<Button variant="ghost" size="sm">
				Filter
			</Button>
		}
	/>
);

export const Loading = () => (
	<NavHeader
		title="Validating"
		description="Running storybook:build"
		right={
			<Button loading variant="secondary" size="sm">
				Checking
			</Button>
		}
	/>
);
export const Empty = () => <NavHeader title="Workspace" description="No active item" />;
export const Error = () => (
	<NavHeader
		title="Workspace"
		description="Health check failed"
		right={<Badge variant="error">alert</Badge>}
	/>
);
export const Collapsed = () => (
	<NavHeader
		title="ITEM-76"
		right={
			<Button aria-label="Open settings" variant="ghost" size="sm">
				<Icon name="settings-2" size={14} />
			</Button>
		}
	/>
);
export const Mobile = () => (
	<div className="w-[360px]">
		<NavHeader
			title="Flow"
			description="ITEM-76"
			right={
				<Button variant="ghost" size="sm">
					Menu
				</Button>
			}
		/>
	</div>
);

export default {
	title: "Patterns/NavHeader",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["layout-header-height", "color-bg-surface", "color-border", "text-h2"],
			consumes: ["Badge", "Button", "Icon"],
			surfaces: [
				"HomeView",
				"FlowView",
				"ExecutionView",
				"ContextView",
				"SpecsView",
				"WorkspacesView",
			],
			a11y: ["header-landmark", "action-buttons"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
