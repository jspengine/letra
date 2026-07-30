import "./index.css";
import { Button } from "./button";
import { GlobalHeader } from "./global-header";

const workspaces = [
	{ id: "letra", name: "Letra" },
	{ id: "sandbox", name: "Sandbox" },
];

const scopes = [
	{ id: "C:/Workspace/letra/packages/client", label: "client" },
	{ id: "C:/Workspace/letra/packages/cli", label: "cli" },
];

const userSlot = (
	<Button type="button" variant="ghost" size="sm" className="size-8 px-0" aria-label="Conta de Renan" title="Conta">
		<span className="inline-flex size-6 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-bg-sunken)] text-caption font-semibold">
			R
		</span>
	</Button>
);

export const Default = () => (
	<GlobalHeader
		workspaces={workspaces}
		activeWorkspaceId="letra"
		scopes={scopes}
		activeScopeId="C:/Workspace/letra/packages/client"
		theme="dark"
		onThemeChange={() => undefined}
	/>
);

export const ActionableSignals = () => (
	<GlobalHeader
		workspaces={workspaces}
		activeWorkspaceId="letra"
		scopes={scopes}
		activeScopeId={null}
		pendingDecisions={2}
		health={{ activeAlerts: 3, criticalAlerts: 1 }}
		theme="dark"
		onThemeChange={() => undefined}
		onOpenHealthCenter={() => undefined}
	/>
);

export const NoWorkspace = () => (
	<GlobalHeader
		workspaces={[]}
		activeWorkspaceId={null}
		scopes={[]}
		health={null}
		pendingDecisions={0}
		theme="light"
		onThemeChange={() => undefined}
	/>
);

export const WithFutureUserSlot = () => (
	<GlobalHeader
		workspaces={workspaces}
		activeWorkspaceId="letra"
		scopes={scopes}
		activeScopeId={null}
		theme="dark"
		onThemeChange={() => undefined}
		userSlot={userSlot}
	/>
);

export const Mobile = () => (
	<div className="w-[360px]">
		<GlobalHeader
			workspaces={workspaces}
			activeWorkspaceId="letra"
			scopes={scopes}
			activeScopeId="C:/Workspace/letra/packages/client"
			pendingDecisions={1}
			health={{ activeAlerts: 1, criticalAlerts: 0 }}
			theme="light"
			onThemeChange={() => undefined}
		/>
	</div>
);

export default {
	title: "Patterns/GlobalHeader",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Canonical application header contract. Stories define the props and states that the client shell should implement: global sidebar action first, workspace/scope context, named actionable supervision signals, utilities, and future user slot. Diagnostic corrections belong in the supervision surface, not in the global header.",
			},
		},
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["layout-header-height", "app-header-bg", "color-bg-surface", "color-border", "color-text-primary", "color-primary"],
			consumes: ["Button", "Badge", "Select", "Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["header-landmark", "sidebar-toggle-first", "single-context-selector", "named-actionable-signals", "future-user-slot"],
			breakpoints: ["mobile", "desktop"],
			props: [
				"workspaces",
				"activeWorkspaceId",
				"scopes",
				"activeScopeId",
				"pendingDecisions",
				"health",
				"theme",
				"userSlot",
			],
		},
	},
};
