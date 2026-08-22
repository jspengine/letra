import { GlobalHeader, useSidebar } from "@letra/ui";
import type { WorkspaceData } from "../Workspaces/WorkspacesView";

interface Props {
	description?: string;
	theme: "light" | "dark";
	onThemeChange: (t: "light" | "dark") => void;
	onOpenHistory?: () => void;
	gateCount?: number;
	activeDirectory?: string | null;
	workspaces: WorkspaceData[];
	activeWorkspace?: WorkspaceData | null;
	onWorkspaceChange?: (ws: WorkspaceData) => void;
	onDirectoryChange?: (dir: string | null) => void;
	health?: { activeAlerts: number; criticalAlerts: number } | null;
	onOpenHealthCenter?: () => void;
	onOpenWorkspaceSettings?: () => void;
}

function directoryLabel(path?: string | null) {
	if (!path) return "Todo o workspace";
	return path.split(/[/\\]/).pop() || path;
}

export default function Header({
	theme,
	onThemeChange,
	gateCount = 0,
	activeDirectory,
	workspaces,
	activeWorkspace,
	onWorkspaceChange,
	onDirectoryChange,
	health,
	onOpenHealthCenter,
	onOpenWorkspaceSettings,
}: Props) {
	const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
	const directories = activeWorkspace?.directories ?? [];

	return (
		<GlobalHeader
			sidebarOpen={sidebarOpen}
			onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
			workspaces={workspaces.map((workspace) => ({ id: workspace.slug, name: workspace.name }))}
			activeWorkspaceId={activeWorkspace?.slug ?? null}
			scopes={directories.map((directory) => ({ id: directory, label: directoryLabel(directory) }))}
			activeScopeId={activeDirectory ?? null}
			onWorkspaceChange={(slug) => {
				const workspace = workspaces.find((entry) => entry.slug === slug);
				if (workspace) onWorkspaceChange?.(workspace);
			}}
			onScopeChange={onDirectoryChange}
			pendingDecisions={gateCount}
			health={health}
			onOpenHealthCenter={onOpenHealthCenter}
			onOpenSettings={activeWorkspace ? onOpenWorkspaceSettings : undefined}
			theme={theme}
			onThemeChange={onThemeChange}
		/>
	);
}
