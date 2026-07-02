import { useEffect, useState, useCallback } from "react";
import type { Workflow, ResolvedSpec, Item } from "@letra/types";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import {
	Card,
	CardContent,
	Badge,
	Icon,
	Progress,
	Alert,
	Button,
	Tooltip,
	Separator,
	Skeleton,
	SkeletonCard,
	EmptyState,
	ErrorBanner,
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetClose,
	SheetFooter,
	cn,
} from "@letra/ui";
import type { IconName } from "@letra/ui";
import { doneStageIds, humanGateStageIds, orderedStages, stageAgentLabel } from "../../lib/active-flow";

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	onSelectItem: (id: string) => void;
	onTabChange?: (tab: "specs" | "board") => void;
}

// ── Types ──

type StageStatus = "idle" | "running" | "done" | "blocked" | "waiting";
type GateStatus = "waiting" | "available" | "approved" | "changes-requested" | "rejected";

interface GateData {
	id: string;
	feature: string;
	stage: string;
	agent: string;
	status: GateStatus;
	since: string;
}

interface FocusData {
	active: boolean;
	spec?: string;
	content?: string;
}

interface Decision {
	name: string;
	content: string;
}

interface PipelineStage {
	id: string;
	label: string;
	status: StageStatus;
	itemCount: number;
}

interface SystemAction {
	id: string;
	label: string;
	cadence: string;
	cause: string;
	effect: string;
	status: "active" | "idle" | "success" | "error";
	lastRunAt: string | null;
	lastOutcome: "armed" | "triggered" | "completed" | "failed" | null;
}

// ── Helpers ──

function daysSince(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function timeSince(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "agora";
	if (mins < 60) return `${mins}min`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	return `${days}d`;
}

// ── Pipeline Progress Header ──

function PipelineProgress({ stages, workflow }: { stages: PipelineStage[]; workflow: Workflow }) {
	const doneCount = stages.filter((s) => s.status === "done").length;
	const totalCount = stages.length;
	const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
	const activeRunning = stages.find((s) => s.status === "running");
	const totalItems = workflow.items.length;
	const staleItems = workflow.items.filter((it) => daysSince(it.createdAt) > 7).length;

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
				<div className="flex items-center gap-2">
					<span className="font-medium" style={{ color: "var(--foreground)" }}>{workflow.name}</span>
					<span className="hidden sm:inline">{totalItems} itens</span>
					{activeRunning && (
						<Badge variant="outline" className="gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
							{activeRunning.label}
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-3">
					<span>{doneCount}/{totalCount} stages</span>
					<span style={{ color: pct === 100 ? "var(--success)" : "var(--primary)" }}>{pct}%</span>
					{staleItems > 0 && (
						<Tooltip content={`${staleItems} item(ns) parado(s) há >7 dias`}>
							<Badge
								variant="warning"
								className={cn(
									workflow.items.filter((it) => daysSince(it.createdAt) > 14).length > 0 && "animate-pulse-gate-urgent",
								)}
							>
								{staleItems} stale
							</Badge>
						</Tooltip>
					)}
				</div>
			</div>
			<Progress value={doneCount} max={totalCount} size="sm" />
		</div>
	);
}

// ── Gate Alert (CTA principal) ──

function GateAlert({ gates, onApprove, onChanges, onReject }: {
	gates: GateData[];
	onApprove?: (id: string) => void;
	onChanges?: (id: string) => void;
	onReject?: (id: string) => void;
}) {
	const actionable = gates.filter((g) => g.status === "available");
	if (actionable.length === 0) return null;

	return (
		<Alert variant="warning" className="flex-col gap-3">
			<div className="flex items-center gap-2">
				<Icon name="shield" size={16} />
				<span className="font-semibold">
					{actionable.length} Gate{actionable.length > 1 ? "s" : ""} Pendente{actionable.length > 1 ? "s" : ""}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				{actionable.map((g) => (
					<div key={g.id} className="flex items-start justify-between gap-4 p-2 rounded-lg" style={{ background: "var(--muted)" }}>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 text-xs mb-0.5">
								<span className="font-medium">{g.feature}</span>
								<span style={{ color: "var(--muted-foreground)" }}>· {g.stage} · há {timeSince(g.since)}</span>
							</div>
						</div>
						<div className="flex items-center gap-1.5 shrink-0">
							<Button variant="ghost" size="sm" onClick={() => onChanges?.(g.id)}>Alterar</Button>
							<Button variant="ghost" size="sm" onClick={() => onReject?.(g.id)}>Rejeitar</Button>
							<Button variant="default" size="sm" onClick={() => onApprove?.(g.id)}>Aprovar</Button>
						</div>
					</div>
				))}
			</div>
		</Alert>
	);
}

// ── Focus Card ──

function FocusCard({ workflow, activeFlow, focus, onTabChange, onItemSelect }: {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	focus: FocusData | null;
	onTabChange?: (tab: "board") => void;
	onItemSelect?: (item: Item) => void;
}) {
	const primaryItem = workflow.primaryItemId
		? workflow.items.find((it) => it.id === workflow.primaryItemId)
		: workflow.items[0];

	const activeFocus = focus?.active ? focus : null;

	if (!primaryItem && !activeFocus) {
		return (
			<Card className="p-4">
				<CardContent className="p-0 flex flex-col gap-2">
					<div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Foco</div>
					<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum item em andamento</p>
					<Button variant="outline" size="sm" onClick={() => onTabChange?.("board")}>
						Ver backlog
					</Button>
				</CardContent>
			</Card>
		);
	}

	const stage = primaryItem
		? orderedStages(workflow, activeFlow).find((entry) => entry.id === primaryItem.stage)
		: null;
	const stageName = stage?.name || primaryItem?.stage || "";
	const days = primaryItem ? daysSince(primaryItem.createdAt) : 0;

	const stageColors: Record<string, string> = {
		idle: "var(--muted-foreground)",
		running: "var(--primary)",
	};

	return (
		<Card className="p-4">
			<CardContent className="p-0 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
						<Icon name="star" size={12} className="inline mr-1" />
						Foco Atual
					</div>
					<Button variant="ghost" size="sm" onClick={() => onTabChange?.("board")}>
						Ver board →
					</Button>
				</div>
				{activeFocus && (
					<div className="flex items-center gap-2 text-sm mb-1">
						<Icon name="book" size={14} style={{ color: "var(--primary)" }} />
						<span className="font-medium truncate">{activeFocus.spec}</span>
						<Badge variant="secondary">spec</Badge>
					</div>
				)}
				{primaryItem && (
					<Button
						type="button"
						onClick={() => onItemSelect?.(primaryItem)}
						className="flex flex-col gap-1 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50 text-left"
					>
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold truncate">{primaryItem.id}</span>
							<Badge variant="outline">{stageName}</Badge>
							{days > 0 && (
								<span className="text-xs tabular-nums" style={{ color: days > 7 ? "var(--warning)" : "var(--muted-foreground)" }}>
									{days}d
								</span>
							)}
						</div>
						<p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
							{primaryItem.description}
						</p>
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// ── Pipeline Snapshot ──

function compactStageLabel(name: string): string {
	return name.length <= 8 ? name : name.slice(0, 8);
}

function stageStatus(stageId: string, wf: Workflow, activeFlow: ActiveFlowDefinition | null): StageStatus {
	const humanGates = humanGateStageIds(wf, activeFlow);
	const doneStages = doneStageIds(wf, activeFlow);
	const items = wf.items.filter((it) => it.stage === stageId);
	if (items.length === 0) return "idle";
	if (doneStages.has(stageId)) return "done";
	if (humanGates.has(stageId)) return "waiting";
	return "running";
}

function buildStages(wf: Workflow, activeFlow: ActiveFlowDefinition | null): PipelineStage[] {
	return orderedStages(wf, activeFlow).map((s) => ({
		id: s.id,
		label: compactStageLabel(s.name),
		status: stageStatus(s.id, wf, activeFlow),
		itemCount: wf.items.filter((it) => it.stage === s.id).length,
	}));
}

const STATUS_BG: Record<StageStatus, string> = {
	idle: "var(--muted)",
	running: "var(--primary)",
	done: "var(--success)",
	blocked: "var(--gate-blocked)",
	waiting: "var(--gate-waiting)",
};

function PipelineSnapshot({ workflow, activeFlow, onTabChange }: { workflow: Workflow; activeFlow: ActiveFlowDefinition | null; onTabChange?: (tab: "board") => void }) {
	const stages = buildStages(workflow, activeFlow);
	const currentIdx = stages.findIndex((s) => s.status === "running" || s.status === "waiting");

	return (
		<Card className="p-4">
			<CardContent className="p-0 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
						<Icon name="bar-chart" size={12} className="inline mr-1" />
						Pipeline
					</div>
					<Button variant="ghost" size="sm" onClick={() => onTabChange?.("board")}>
						Detalhes →
					</Button>
				</div>
				<div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
					{stages.map((s, idx) => {
						const isActive = s.status === "running" || s.status === "waiting";
						return (
							<div key={s.id} className="flex items-center gap-2 shrink-0">
								<div className="flex flex-col items-center gap-1 min-w-[56px]">
									<div
										className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold"
										style={{
											background: STATUS_BG[s.status],
											color: s.status === "idle" ? "var(--muted-foreground)" : "white",
											boxShadow: isActive ? "0 0 0 3px var(--primary)/20" : "none",
										}}
									>
										{s.status === "done" ? (
											<Icon name="check" size={12} />
										) : s.status === "waiting" ? (
											<Icon name="clock" size={12} />
										) : s.status === "running" ? (
											<Icon name="chevron-right" size={12} />
										) : (
											<span>{s.itemCount}</span>
										)}
									</div>
									<span
										className="text-[10px] font-medium leading-tight text-center"
										style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
									>
										{s.label}
									</span>
									{s.itemCount > 0 && (
										<Badge variant="secondary" className="text-[9px] px-1 py-0">
											{s.itemCount}
										</Badge>
									)}
								</div>
								{idx < stages.length - 1 && (
									<div
										className="w-3 h-px shrink-0"
										style={{ background: s.status === "done" ? "var(--success)" : "var(--border)" }}
									/>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function SystemActionsCard() {
	const [actions, setActions] = useState<SystemAction[]>([]);
	const [loaded, setLoaded] = useState(false);

	const refresh = useCallback(() => {
		fetch("/api/system-actions")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data?.actions)) setActions(data.actions);
			})
			.catch(() => {})
			.finally(() => setLoaded(true));
	}, []);

	useEffect(() => {
		refresh();
		const source = new EventSource("/api/events");
		source.addEventListener("system-action-updated", refresh);
		return () => source.close();
	}, [refresh]);

	const badgeVariant = (status: SystemAction["status"]): "outline" | "secondary" | "success" | "warning" => {
		if (status === "error") return "warning";
		if (status === "success") return "success";
		if (status === "active") return "secondary";
		return "outline";
	};

	return (
		<Card className="p-4">
			<CardContent className="p-0 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
						<Icon name="activity" size={12} className="inline mr-1" />
						Automações Supervisionáveis
					</div>
					<Badge variant="outline">{actions.length}</Badge>
				</div>
				{!loaded ? (
					<div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Carregando...</div>
				) : (
					<div className="flex flex-col gap-2">
						{actions.map((action) => (
							<div key={action.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-medium truncate">{action.label}</div>
										<div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
											{action.cadence}
										</div>
									</div>
									<Badge variant={badgeVariant(action.status)}>
										{action.lastOutcome ?? action.status}
									</Badge>
								</div>
								<div className="mt-2 text-xs flex flex-col gap-1" style={{ color: "var(--muted-foreground)" }}>
									<div><strong>Causa:</strong> {action.cause}</div>
									<div><strong>Efeito:</strong> {action.effect}</div>
									<div>
										<strong>Última execução:</strong>{" "}
										{action.lastRunAt ? new Date(action.lastRunAt).toLocaleString("pt-BR") : "ainda não executada"}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ── Metric Cards ──

function MetricCards({ workflow, activeFlow, gates, onTabChange }: {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	gates: GateData[];
	onTabChange?: (tab: "board") => void;
}) {
	const totalItems = workflow.items.length;
	const resolvedStages = orderedStages(workflow, activeFlow);
	const doneStages = doneStageIds(workflow, activeFlow);
	const doingItems = workflow.items.filter((it) => {
		const stage = resolvedStages.find((entry) => entry.id === it.stage);
		const index = stage ? resolvedStages.indexOf(stage) : -1;
		return stage?.zone === "doing" || (!stage?.zone && index > 0 && index < resolvedStages.length - 1);
	}).length;
	const doneItems = workflow.items.filter((item) => doneStages.has(item.stage)).length;
	const staleItems = workflow.items.filter((it) => daysSince(it.createdAt) > 7).length;
	const actionableGates = gates.filter((g) => g.status === "available").length;

	const metrics: { label: string; value: string | number; icon: IconName; subtext: string }[] = [
		{
			label: "Itens",
			value: totalItems,
			icon: "list-three",
			subtext: `${doingItems} em andamento · ${doneItems} concluídos`,
		},
		{
			label: "Gates",
			value: actionableGates,
			icon: "shield",
			subtext: `${gates.length} total · ${actionableGates} pendente${actionableGates !== 1 ? "s" : ""}`,
		},
		{
			label: "Stale",
			value: staleItems,
			icon: "clock",
			subtext: staleItems > 0 ? "Itens parados >7 dias" : "Nenhum item parado",
		},
		{
			label: "Health",
			value: workflow.items.length > 0 ? `${Math.round((doneItems / workflow.items.length) * 100)}%` : "—",
			icon: "check-circle",
			subtext: `${doneItems} done · ${workflow.items.length - doneItems} pendente${workflow.items.length - doneItems !== 1 ? "s" : ""}`,
		},
	];

	function isStaleCritical(label: string): boolean {
		if (label === "Stale") {
			const oldest = workflow.items
				.filter((it) => daysSince(it.createdAt) > 7)
				.some((it) => daysSince(it.createdAt) > 14);
			return oldest;
		}
		return false;
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			{metrics.map((m) => (
				<Card
					key={m.label}
					className={cn(
						"p-3",
						isStaleCritical(m.label) && "animate-pulse-gate-urgent",
					)}
				>
					<CardContent className="p-0 flex flex-col gap-1">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<Icon name={m.icon} size={14} style={{ color: isStaleCritical(m.label) ? "var(--warning)" : "var(--muted-foreground)" }} />
								<span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{m.label}</span>
							</div>
							<DropdownMenu>
								{({ open, setOpen }) => (
									<>
										<DropdownMenuTrigger asChild>
											<Button
												type="button"
												className="rounded p-0.5 transition-colors hover:bg-muted/50"
												aria-label={`Menu ${m.label}`}
												onClick={() => setOpen(!open)}
											>
												<Icon name="chevron-down" size={12} style={{ color: "var(--muted-foreground)" }} />
											</Button>
										</DropdownMenuTrigger>
										{open && (
											<DropdownMenuContent align="end" className="z-50" onClick={() => setOpen(false)}>
												<DropdownMenuItem onClick={() => onTabChange?.("board")}>
													<Icon name="bar-chart" size={14} />
													Ir para board
												</DropdownMenuItem>
											</DropdownMenuContent>
										)}
									</>
								)}
							</DropdownMenu>
						</div>
						<span className="text-xl font-bold">{m.value}</span>
						<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.subtext}</span>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

// ── Specs Recent List ──

function SpecsRecent({ specs, onTabChange }: { specs: ResolvedSpec[]; onTabChange?: (tab: "specs") => void }) {
	const [collapsed, setCollapsed] = useState(false);

	const sorted = [...specs]
		.sort((a, b) => {
			const da = a.content.match(/> Updated:\s*(\d{4}-\d{2}-\d{2})/);
			const db = b.content.match(/> Updated:\s*(\d{4}-\d{2}-\d{2})/);
			return (db ? new Date(db[1]).getTime() : 0) - (da ? new Date(da[1]).getTime() : 0);
		})
		.slice(0, 4);

	if (sorted.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			<Button
				type="button"
				onClick={() => setCollapsed(!collapsed)}
				className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
				style={{ color: "var(--muted-foreground)" }}
			>
				<span>Specs Recentes ({specs.length})</span>
				<Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} />
			</Button>
			{!collapsed && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{sorted.map((spec) => {
						const hasOutcome = /## Outcome/.test(spec.content);
						const hasAC = /## Acceptance Criteria/.test(spec.content);
						const acDone = (spec.content.match(/-\s+\[x\]/g) || []).length;
						const acTotal = (spec.content.match(/-\s+\[(\s|x)\]/g) || []).length;
						const pct = acTotal > 0 ? Math.round((acDone / acTotal) * 100) : 0;
						return (
							<Card key={spec.id} className="p-3">
								<CardContent className="p-0">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium truncate flex-1">{spec.id}</span>
										<Badge variant={hasOutcome && hasAC ? "success" : "warning"}>{pct}%</Badge>
									</div>
									<div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
										<span className="flex items-center gap-1">
											<Icon name="check" size={12} style={{ color: hasOutcome && hasAC ? "var(--success)" : "var(--warning)" }} />
											{acTotal} ACs
										</span>
										<span>· {hasOutcome ? "completa" : "rascunho"}</span>
									</div>
								</CardContent>
							</Card>
						);
					})}
					{specs.length > 4 && (
						<Button variant="ghost" size="sm" onClick={() => onTabChange?.("specs")} className="self-start">
							Ver todas ({specs.length}) →
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

// ── Item Detail Sheet ──

function ItemDetailSheet({ item, workflow, activeFlow, open, onOpenChange }: {
	item: Item | null;
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	if (!item || !open) return null;

	const stage = orderedStages(workflow, activeFlow).find((entry) => entry.id === item.stage);
	const spec = item.spec ? workflow.specLinks?.[item.spec] : null;
	const days = daysSince(item.createdAt);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader>
					<div className="flex items-center gap-2">
						<Icon name="list-three" size={16} />
						<SheetTitle>{item.id}</SheetTitle>
					</div>
					<div className="flex items-center gap-2">
						{stage && <Badge variant="outline">{stage.name}</Badge>}
						<span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
							{days === 0 ? "hoje" : `${days}d atrás`}
						</span>
					</div>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
							Descrição
						</span>
						<p className="text-sm">{item.description || "Sem descrição"}</p>
					</div>

					{item.claimedBy && (
						<div className="flex flex-col gap-1">
							<span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
								Claimed por
							</span>
							<div className="flex items-center gap-2 text-sm">
								<Icon name="user" size={14} />
								<span>{item.claimedBy}</span>
								{item.claimedAt && (
									<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
										· {daysSince(item.claimedAt)}d atrás
									</span>
								)}
							</div>
						</div>
					)}

					{spec && (
						<div className="flex flex-col gap-1">
							<span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
								Spec
							</span>
							<span className="text-sm text-primary flex items-center gap-1">
								<Icon name="file-text" size={14} />
								{item.spec}
							</span>
						</div>
					)}

					{item.tasks && item.tasks.length > 0 && (
						<div className="flex flex-col gap-1">
							<span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
								Tasks ({item.tasks.filter((t) => t.done).length}/{item.tasks.length})
							</span>
							<div className="flex flex-col gap-1">
								{item.tasks.map((t) => (
									<div key={t.id} className="flex items-center gap-2 text-sm">
										<Icon
											name={t.done ? "check-circle" : "circle"}
											size={14}
											style={{ color: t.done ? "var(--success)" : "var(--muted-foreground)" }}
										/>
										<span className={t.done ? "line-through" : ""} style={{ color: t.done ? "var(--muted-foreground)" : "var(--foreground)" }}>
											{t.description}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<SheetFooter>
					<SheetClose asChild>
						<Button variant="outline">Fechar</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

// ── Dashboard Loading Skeleton ──

function DashboardSkeleton() {
	return (
		<div className="flex flex-col flex-1 min-h-0">
			<div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
				<div className="flex w-full flex-col gap-6">
					<div className="flex flex-col gap-2">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-2 w-full" />
					</div>
					<Skeleton className="h-24 w-full rounded-xl" />
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<SkeletonCard />
						<SkeletonCard />
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Main HomeView ──

export default function HomeView({ workflow, activeFlow, onSelectItem, onTabChange }: Props) {
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [focus, setFocus] = useState<FocusData | null>(null);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [specsLoaded, setSpecsLoaded] = useState(false);
	const [specsError, setSpecsError] = useState(false);
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	useEffect(() => {
		Promise.all([
			fetch("/api/specs").then((r) => r.json()).then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			}).catch(() => setSpecsError(true)),
			fetch("/api/focus").then((r) => r.json()).then((data) => setFocus(data)).catch(() => {}),
			fetch("/api/context?file=decisions").then((r) => r.json()).then((data) => {
				if (Array.isArray(data)) setDecisions(data);
			}).catch(() => {}),
		]).finally(() => setSpecsLoaded(true));
	}, []);

	if (!specsLoaded) {
		return <DashboardSkeleton />;
	}

	const stages = buildStages(workflow, activeFlow);

	const gates: GateData[] = [];
	for (const stageId of humanGateStageIds(workflow, activeFlow)) {
		const items = workflow.items.filter((it) => it.stage === stageId);
		for (const item of items) {
			gates.push({
				id: `gate-${item.id}`,
				feature: item.description,
				stage: stages.find((stage) => stage.id === stageId)?.label ?? stageId,
				agent: stageAgentLabel(stageId, workflow, activeFlow),
				status: "available",
				since: item.createdAt,
			});
		}
	}

	const recentDecisions = decisions.slice(0, 4);

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
				<div className="flex w-full flex-col gap-6">
					<PipelineProgress stages={stages} workflow={workflow} />

					<GateAlert
						gates={gates}
						onApprove={(id) => {
							const itemId = id.replace("gate-", "");
							onSelectItem(itemId);
						}}
					/>

					<div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
						<FocusCard
							workflow={workflow}
							activeFlow={activeFlow}
							focus={focus}
							onTabChange={onTabChange}
							onItemSelect={(item) => {
								setSelectedItem(item);
								setSheetOpen(true);
							}}
						/>
						<PipelineSnapshot workflow={workflow} activeFlow={activeFlow} onTabChange={onTabChange} />
					</div>

					<MetricCards
						workflow={workflow}
						activeFlow={activeFlow}
						gates={gates}
						onTabChange={onTabChange}
					/>

					<SystemActionsCard />

					{specsError ? (
						<ErrorBanner onRetry={() => window.location.reload()}>
							Erro ao carregar specs
						</ErrorBanner>
					) : (
						<SpecsRecent specs={specs} onTabChange={onTabChange} />
					)}

					{recentDecisions.length > 0 && (
						<div className="flex flex-col gap-2">
							<span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
								Decisões Recentes
							</span>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
								{recentDecisions.map((d) => (
									<Card key={d.name} className="p-3">
										<CardContent className="p-0">
											<div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{d.name}</div>
											<div className="text-sm font-medium truncate">{d.content.match(/^#\s+(.+)/m)?.[1] || d.name}</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					)}

					<ItemDetailSheet
						item={selectedItem}
						workflow={workflow}
						activeFlow={activeFlow}
						open={sheetOpen}
						onOpenChange={setSheetOpen}
					/>
				</div>
			</div>
		</div>
	);
}
