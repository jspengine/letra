import "./index.css";
import type { CSSProperties } from "react";
import AppShell from "./app-shell";
import {
	AppSidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "./app-sidebar";
import { GlobalHeader } from "./global-header";
import { Icon, type IconName } from "./icon";

const navItems: Array<{ id: string; label: string; icon: IconName; color: string }> = [
	{ id: "supervision", label: "Supervisao", icon: "shield", color: "var(--color-info)" },
	{ id: "work", label: "Trabalho", icon: "grid", color: "var(--color-primary)" },
	{ id: "knowledge", label: "Conhecimento e Regras", icon: "book", color: "var(--color-agent)" },
	{ id: "activity", label: "Atividade", icon: "activity", color: "var(--color-success)" },
];

const workspaces = [
	{ id: "letra", name: "Letra" },
	{ id: "sandbox", name: "Sandbox" },
];

const scopes = [
	{ id: "C:/Workspace/letra/packages/client", label: "client" },
	{ id: "C:/Workspace/letra/packages/cli", label: "cli" },
];

function CatalogSidebar() {
	return (
		<AppSidebar collapsible="icon" side="left">
			<SidebarHeader
				className="flex flex-row items-center border-b px-4 group-has-[[data-state=collapsed]]/sidebar-wrapper:justify-center group-has-[[data-state=collapsed]]/sidebar-wrapper:px-0"
				style={{ borderColor: "var(--app-sidebar-border, var(--border))", height: "64px" }}
			>
				<div className="flex min-w-0 items-center gap-2 group-has-[[data-state=collapsed]]/sidebar-wrapper:justify-center">
					<Icon name="box" size={18} style={{ color: "var(--color-primary)" }} />
					<span className="truncate text-sm font-semibold text-[var(--color-text-primary)] group-has-[[data-state=collapsed]]/sidebar-wrapper:sr-only">
						Letra
					</span>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navegacao</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item, index) => (
								<SidebarMenuItem key={item.id}>
									<SidebarMenuButton isActive={index === 0} tooltip={item.label} aria-label={item.label}>
										<Icon
											name={item.icon}
											size={16}
											className="transition-transform duration-[var(--motion-fast)] group-hover/sidebar-menu-button:scale-110"
											style={{ color: item.color }}
										/>
										<span className="truncate group-has-[[data-state=collapsed]]/sidebar-wrapper:sr-only">
											{item.label}
										</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</AppSidebar>
	);
}

function CatalogHeader({ collapsed = false, light = false }: { collapsed?: boolean; light?: boolean }) {
	return (
		<GlobalHeader
			sidebarOpen={!collapsed}
			onToggleSidebar={() => undefined}
			workspaces={workspaces}
			activeWorkspaceId="letra"
			scopes={scopes}
			activeScopeId="C:/Workspace/letra/packages/client"
			pendingDecisions={2}
			health={{ activeAlerts: 3, criticalAlerts: 1 }}
			onOpenHealthCenter={() => undefined}
			theme={light ? "light" : "dark"}
			onThemeChange={() => undefined}
		/>
	);
}

function ShellFrame({ collapsed = false, long = false, light = false }: { collapsed?: boolean; long?: boolean; light?: boolean }) {
	return (
		<div className={`${light ? "light " : ""}h-[420px] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)]`}>
			<SidebarProvider
				defaultOpen={!collapsed}
				className="contents"
				style={{
					"--sidebar-width": "var(--layout-sidebar-width)",
					"--sidebar-width-icon": "var(--layout-sidebar-width-collapsed)",
				} as CSSProperties}
			>
				<AppShell sidebar={<CatalogSidebar />} header={<CatalogHeader collapsed={collapsed} light={light} />} sidebarCollapsed={collapsed}>
					<div className={`${long ? "min-h-[760px]" : ""} p-[var(--space-4)] text-sm`}>
						{long ? "Content taller than the viewport keeps the sidebar stretched with the shell." : "Content area"}
					</div>
				</AppShell>
			</SidebarProvider>
		</div>
	);
}

export const Default = () => <ShellFrame />;

export const Collapsed = () => <ShellFrame collapsed />;

export const LightTheme = () => <ShellFrame light />;

export const LongContent = () => <ShellFrame long />;

export default {
	title: "Components/AppShell",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Application frame primitive for sidebar, header, and content layout. It consumes layout tokens from index.css and uses the same Sidebar primitives as the client shell.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["layout-header-height", "layout-sidebar-width", "layout-sidebar-width-collapsed", "app-sidebar-shadow", "app-sidebar-border", "app-header-bg", "background"],
			consumes: ["AppSidebar", "SidebarProvider", "GlobalHeader", "Button", "Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["landmark-ready-layout", "responsive-frame", "single-context-selector", "collapsed-icon-labels", "collapsed-hover-tooltips"],
			breakpoints: ["desktop"],
		},
	},
};
