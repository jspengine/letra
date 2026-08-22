import type { ReactNode } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Icon } from "./icon";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";
import { cn } from "./utils";

export interface GlobalHeaderWorkspace {
	id: string;
	name: string;
}

export interface GlobalHeaderScope {
	id: string;
	label: string;
}

export interface GlobalHeaderHealth {
	activeAlerts: number;
	criticalAlerts?: number;
}

export interface GlobalHeaderProps {
	sidebarOpen?: boolean;
	onToggleSidebar?: () => void;
	workspaces: GlobalHeaderWorkspace[];
	activeWorkspaceId?: string | null;
	scopes?: GlobalHeaderScope[];
	activeScopeId?: string | null;
	onWorkspaceChange?: (workspaceId: string) => void;
	onScopeChange?: (scopeId: string | null) => void;
	pendingDecisions?: number;
	health?: GlobalHeaderHealth | null;
	onOpenHealthCenter?: () => void;
	onOpenSettings?: () => void;
	/**
	 * @deprecated Diagnostics belong in the supervision surface, not in the global header.
	 */
	diagnosticsSlot?: ReactNode;
	onOpenHistory?: () => void;
	theme?: "light" | "dark";
	onThemeChange?: (theme: "light" | "dark") => void;
	userSlot?: ReactNode;
	className?: string;
}

const workspacePrefix = "workspace:";
const scopePrefix = "scope:";
const wholeWorkspaceScope = "__workspace__";

function plural(value: number, singular: string, pluralValue: string) {
	return value === 1 ? singular : pluralValue;
}

export function GlobalHeader({
	sidebarOpen = true,
	onToggleSidebar,
	workspaces,
	activeWorkspaceId,
	scopes = [],
	activeScopeId = null,
	onWorkspaceChange,
	onScopeChange,
	pendingDecisions = 0,
	health,
	onOpenHealthCenter,
	onOpenSettings,
	theme,
	onThemeChange,
	userSlot,
	className,
}: GlobalHeaderProps) {
	const activeWorkspace =
		activeWorkspaceId === undefined
			? workspaces[0]
			: workspaces.find((workspace) => workspace.id === activeWorkspaceId);
	const workspaceName = activeWorkspace?.name ?? "Escolha um workspace";
	const activeScope = scopes.find((scope) => scope.id === activeScopeId);
	const scopeName = activeScope?.label ?? "Todo o workspace";
	const contextValue = activeScopeId ? `${scopePrefix}${activeScopeId}` : `${scopePrefix}${wholeWorkspaceScope}`;
	const hasPendingDecisions = pendingDecisions > 0;
	const hasHealthSignals = Boolean(health && health.activeAlerts > 0);
	const hasSupervisionSignals = hasPendingDecisions || hasHealthSignals;
	const activeAlerts = health?.activeAlerts ?? 0;
	const criticalAlerts = health?.criticalAlerts ?? 0;
	const nextTheme = theme === "dark" ? "light" : "dark";

	return (
		<header
			className={cn(
				"app-header-surface grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,420px)_minmax(0,1fr)_auto]",
				className,
			)}
		>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="col-start-1 row-start-1 size-8 px-0"
				aria-label={sidebarOpen ? "Recolher menu global" : "Expandir menu global"}
				title={sidebarOpen ? "Recolher menu" : "Expandir menu"}
				onClick={onToggleSidebar}
			>
				<Icon name="list-three" size={16} />
			</Button>

			<Select
				value={contextValue}
				onValueChange={(value) => {
					if (value.startsWith(workspacePrefix)) {
						onWorkspaceChange?.(value.slice(workspacePrefix.length));
						return;
					}
					if (value.startsWith(scopePrefix)) {
						const nextScope = value.slice(scopePrefix.length);
						onScopeChange?.(nextScope === wholeWorkspaceScope ? null : nextScope);
					}
				}}
			>
				<SelectTrigger
					aria-label={`Contexto atual: workspace ${workspaceName}, escopo ${scopeName}`}
					className="col-start-2 row-start-1 min-w-0 max-w-[420px] justify-self-start sm:min-w-[240px]"
				>
					<div className="flex min-w-0 items-center gap-2">
						<Icon name="box" size={16} />
						<span className="truncate">{workspaceName}</span>
						<span className="text-[var(--color-text-secondary)]">/</span>
						<Icon name="folder" size={14} className="text-[var(--color-text-secondary)]" />
						<span className="truncate text-[var(--color-text-secondary)]">{scopeName}</span>
					</div>
				</SelectTrigger>
				<SelectContent className="min-w-[280px]">
					<div className="px-2 py-1 text-caption font-semibold uppercase text-[var(--color-text-secondary)]">
						Workspace
					</div>
					{workspaces.length === 0 ? (
						<div className="px-2 py-2 text-sm text-[var(--color-text-secondary)]">
							Nenhum workspace encontrado
						</div>
					) : (
						workspaces.map((workspace) => (
							<SelectItem key={workspace.id} value={`${workspacePrefix}${workspace.id}`}>
								<div className="flex min-w-0 items-center gap-2">
									<Icon name={activeWorkspace?.id === workspace.id ? "check" : "box"} size={14} />
									<span className="truncate">{workspace.name}</span>
								</div>
							</SelectItem>
						))
					)}
					<div className="my-2 border-t border-[var(--color-border)]" />
					<div className="px-2 py-1 text-caption font-semibold uppercase text-[var(--color-text-secondary)]">
						Escopo
					</div>
					<SelectItem value={`${scopePrefix}${wholeWorkspaceScope}`}>Todo o workspace</SelectItem>
					{scopes.map((scope) => (
						<SelectItem key={scope.id} value={`${scopePrefix}${scope.id}`}>
							{scope.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="col-start-1 col-end-4 row-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-start-3 sm:col-end-4 sm:row-start-1 sm:justify-self-start">
					{hasSupervisionSignals ? (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							aria-label={`Abrir supervisao: ${pendingDecisions} ${plural(pendingDecisions, "decisao pendente", "decisoes pendentes")}, ${activeAlerts} ${plural(activeAlerts, "sinal ativo", "sinais ativos")}, ${criticalAlerts} ${plural(criticalAlerts, "bloqueia conclusao", "bloqueiam conclusao")}`}
							className="app-status-pill app-status-pill--action whitespace-nowrap"
							onClick={onOpenHealthCenter}
						>
							<Icon name="shield" size={14} />
							<span>Supervisao</span>
							{hasPendingDecisions ? (
								<Badge variant="amber" icon="clock">
									{pendingDecisions} {plural(pendingDecisions, "decisao", "decisoes")}
								</Badge>
							) : null}
							{hasHealthSignals ? (
								<Badge variant="amber" icon="octagon-alert">
									{activeAlerts} {plural(activeAlerts, "sinal", "sinais")}
								</Badge>
							) : null}
							{criticalAlerts > 0 ? (
								<Badge variant="error" icon="circle-x">
									{criticalAlerts} {plural(criticalAlerts, "bloqueia", "bloqueiam")}
								</Badge>
							) : null}
						</Button>
					) : null}
			</div>

			<div className="col-start-3 row-start-1 flex shrink-0 items-center justify-end gap-2 sm:col-start-4">
				{theme && onThemeChange ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onThemeChange(nextTheme)}
						aria-label={`Alternar para tema ${nextTheme === "light" ? "claro" : "escuro"}`}
						title={`Tema ${nextTheme === "light" ? "claro" : "escuro"}`}
					>
						<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
					</Button>
				) : null}

				{onOpenSettings ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onOpenSettings}
						aria-label="Abrir configurações do workspace"
						title="Configurações do workspace"
					>
						<Icon name="settings" size={16} />
					</Button>
				) : null}

				{userSlot}
			</div>
		</header>
	);
}
