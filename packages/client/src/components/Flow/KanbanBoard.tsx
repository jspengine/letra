import { useState, useCallback, useRef, useEffect } from "react";
import type { ResolvedSpec, Workflow, Item } from "@letra/types";
import { Badge, Icon, Button, Progress, Card, CardContent, Tag } from "@letra/ui";
import { cn } from "../../lib/utils";
import { computeSlug } from "../../lib/item-utils";
import {
	doneStageIds,
	humanGateStageIds,
	itemOperationalState,
	orderedStages,
	stageActionLabel,
	stagePresentation,
	type ActiveFlowDefinition,
	type OperationalState,
} from "../../lib/active-flow";
import GateDecisionActions from "./GateDecisionActions";

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	onSelectItem: (id: string) => void;
	onDropItem: (itemId: string, targetStageId: string) => void;
	onApproveGate?: (gateId: string) => void;
	onItemDecided?: () => void;
	allowDrop?: (item: Workflow["items"][0], targetStageId: string) => boolean;
	specRefreshKey?: number;
	onAddItem?: () => void;
	filter?: string;
	className?: string;
}

function computeItemState(state: OperationalState): {
	key: OperationalState;
	label: string;
	variant: "amber" | "success" | "info" | "error" | "agent";
	tagVariant: "default" | "agent" | "success" | "info" | "warning" | "danger";
	action: string;
	icon: "check-circle" | "clock" | "chevron-right" | "shield" | "circle";
	animate: string;
} {
	if (state === "done")
		return {
			key: state,
			label: "Concluído",
			variant: "success",
			tagVariant: "success",
			action: "Sem ação pendente",
			icon: "check-circle",
			animate: "",
		};
	if (state === "waiting")
		return {
			key: state,
			label: "Precisa de atenção",
			variant: "amber",
			tagVariant: "warning",
			action: "Revisar decisão humana",
			icon: "clock",
			animate: "animate-timeline-dot",
		};
	if (state === "blocked")
		return {
			key: state,
			label: "Bloqueado",
			variant: "error",
			tagVariant: "danger",
			action: "Examinar bloqueio",
			icon: "shield",
			animate: "",
		};
	if (state === "running")
		return {
			key: state,
			label: "Em andamento",
			variant: "agent",
			tagVariant: "agent",
			action: "Acompanhar trabalho ativo",
			icon: "chevron-right",
			animate: "animate-agent-running",
		};
	return {
		key: state,
		label: "Na fila",
		variant: "info",
		tagVariant: "default",
		action: "Aguardando responsável",
		icon: "circle",
		animate: "",
	};
}

function emptyStateForFilter(filter: string): { title: string; description: string } {
	if (filter === "attention") {
		return {
			title: "Nenhum trabalho precisa de atenção agora.",
			description: "Gates humanos e bloqueios aparecerão aqui quando exigirem revisão.",
		};
	}
	if (filter === "running") {
		return {
			title: "Nenhum trabalho está em andamento.",
			description: "Quando um item estiver associado a um ator, ele aparecerá neste recorte.",
		};
	}
	if (filter === "queued") {
		return {
			title: "Nenhum trabalho está na fila.",
			description:
				"Itens sem responsável declarado aparecerão aqui antes de entrarem em andamento.",
		};
	}
	if (filter === "done") {
		return {
			title: "Nenhum trabalho concluído ainda.",
			description: "Itens em estágios finais aparecerão neste recorte.",
		};
	}
	return {
		title: "Nenhum trabalho neste fluxo.",
		description: "Crie um item quando houver algo para supervisionar.",
	};
}

function ItemCard({
	item,
	workflow,
	activeFlow,
	specs,
	onClick,
	onDragStart,
	onDragEnd,
}: {
	item: Workflow["items"][0];
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	specs: ResolvedSpec[];
	onClick: () => void;
	onDragStart: (e: React.DragEvent) => void;
	onDragEnd: (e: React.DragEvent) => void;
}) {
	const slug = computeSlug(item, specs, workflow);
	const daysInStage = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
	const isHumanGate = humanGateStageIds(workflow, activeFlow).has(item.stage);
	const state = computeItemState(itemOperationalState(item, workflow, activeFlow));

	const linkedSpec = item.spec ? specs.find((s) => s.id === item.spec) : null;
	const progress = linkedSpec
		? (() => {
				const acDone = (linkedSpec.content.match(/-\s+\[x\]/g) || []).length;
				const acTotal = (linkedSpec.content.match(/-\s+\[(\s|x)\]/g) || []).length;
				return {
					done: acDone,
					total: acTotal,
					label: acTotal > 0 ? `${acDone}/${acTotal} critérios` : "Sem critérios",
					source: "Critérios",
				};
			})()
		: item.tasks && item.tasks.length > 0
			? {
					done: item.tasks.filter((task) => task.done).length,
					total: item.tasks.length,
					label: `${item.tasks.filter((task) => task.done).length}/${item.tasks.length} tarefas`,
					source: "Tarefas",
				}
			: {
					done: 0,
					total: 0,
					label: "Sem checklist",
					source: "Evidência",
				};

	const resolvedStage = orderedStages(workflow, activeFlow).find(
		(stage) => stage.id === item.stage,
	);
	const agentName = item.claimedBy ?? resolvedStage?.roles[0]?.label ?? "Não atribuído";
	const agentAction = resolvedStage ? stageActionLabel(resolvedStage) : "Processando";
	const isRunning = state.key === "running";
	const hasProgress = progress.total > 0;
	const progressValue = progress.total > 0 ? progress.done : 0;
	const progressMax = progress.total > 0 ? progress.total : 1;
	const progressState =
		state.key === "blocked"
			? "error"
			: state.key === "waiting"
				? "warning"
				: state.key === "done"
					? "complete"
					: state.key === "running"
						? "agent"
						: "default";
	const title = item.description?.trim() || linkedSpec?.id || slug;
	const ageLabel = daysInStage === 0 ? "Hoje no fluxo" : `${daysInStage}d no fluxo`;
	const cardBorder =
		state.key === "blocked"
			? "var(--color-danger)"
			: state.key === "waiting"
				? "var(--color-primary)"
				: isRunning
					? "var(--color-agent)"
					: isHumanGate
						? "var(--color-success)"
						: "var(--color-border)";
	const cardBackground =
		state.key === "blocked"
			? "color-mix(in oklch, var(--color-danger) 5%, var(--color-bg-surface))"
			: state.key === "waiting"
				? "color-mix(in oklch, var(--color-primary) 6%, var(--color-bg-surface))"
				: isRunning
					? "color-mix(in oklch, var(--color-agent) 5%, var(--color-bg-surface))"
					: "var(--color-bg-surface)";

	return (
		<Card
			variant={isRunning ? "agent" : "default"}
			className={cn(
				"app-board-card cursor-grab select-none active:cursor-grabbing hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
				isHumanGate && "animate-human-pulse",
				item.claimedBy && "ring-1",
			)}
			style={{ borderColor: cardBorder, background: cardBackground }}
			data-claimed={item.claimedBy ? "true" : "false"}
			data-gate={isHumanGate ? "true" : "false"}
			data-running={isRunning ? "true" : "false"}
			draggable
			role="button"
			tabIndex={0}
			aria-label={`Abrir ${item.id}: ${title}`}
			onClick={onClick}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onClick();
				}
			}}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
		>
			<CardContent className="min-w-0 gap-3 p-3.5">
				<div className="grid min-w-0 gap-2">
					<div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
						<span className="min-w-0 truncate font-mono text-[11px] font-medium text-[var(--color-text-tertiary)]">
							{item.id}
						</span>
						<Badge
							variant={state.variant}
							tone="soft"
							className={cn("max-w-full shrink-0", state.animate)}
							icon={state.icon}
						>
							{state.label}
						</Badge>
					</div>
					<h3 className="line-clamp-3 text-body-sm font-semibold leading-snug text-[var(--color-text-primary)]">
						{title}
					</h3>
				</div>

				<div className="grid gap-1.5">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<Tag>{resolvedStage?.name ?? item.stage}</Tag>
						<Tag>{ageLabel}</Tag>
					</div>
					<p className="line-clamp-2 text-caption leading-snug text-[var(--color-text-secondary)]">
						{linkedSpec ? `Especificação ${linkedSpec.id}` : `Evidência ${slug}`}
					</p>
				</div>

				<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-caption text-[var(--color-text-secondary)]">
					<Tag variant={item.claimedBy ? "agent" : "default"}>
						<Icon name={item.claimedBy ? "bot" : "circle"} size={10} />
						{agentName}
					</Tag>
					<span className="min-w-0 flex-1 basis-32 truncate">{agentAction}</span>
				</div>

				{hasProgress ? (
					<div className="grid gap-1">
						<div className="flex items-center justify-between gap-2">
							<span className="text-caption font-medium text-[var(--color-text-secondary)]">
								{progress.source}
							</span>
							<span className="text-caption tabular-nums text-[var(--color-text-secondary)]">
								{progress.label}
							</span>
						</div>
						<Progress
							value={progressValue}
							max={progressMax}
							size="xs"
							state={progressState}
						/>
					</div>
				) : null}

				<div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-2 py-1.5">
					<div className="flex min-w-0 items-center gap-1.5 text-caption font-medium text-[var(--color-text-primary)]">
						<Icon name={state.icon} size={12} />
						<span className="min-w-0 whitespace-normal leading-snug">
							{state.action}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default function KanbanBoard({
	workflow,
	activeFlow,
	onSelectItem,
	onDropItem,
	onApproveGate,
	onItemDecided,
	allowDrop,
	specRefreshKey,
	onAddItem,
	filter = "all",
	className,
}: Props) {
	const [dragOver, setDragOver] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const dragItem = useRef<Workflow["items"][0] | null>(null);

	const loadSpecs = useCallback(async () => {
		try {
			const res = await fetch("/api/specs");
			if (!res.ok) return;
			const list: ResolvedSpec[] = await res.json();
			setSpecs(list);
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		loadSpecs();
	}, [loadSpecs]);

	useEffect(() => {
		if (specRefreshKey) loadSpecs();
	}, [specRefreshKey, loadSpecs]);

	const handleDragStart = useCallback(
		(e: React.DragEvent, itemId: string) => {
			const item = workflow.items.find((it) => it.id === itemId);
			if (!item) return;
			dragItem.current = item;
			setDraggingId(itemId);
			e.dataTransfer.setData("text/plain", itemId);
			e.dataTransfer.dropEffect = "move";
		},
		[workflow.items],
	);

	const handleDragEnd = useCallback(() => {
		setDragOver(null);
		setDraggingId(null);
		dragItem.current = null;
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}, []);

	const handleDragEnter = useCallback((stageId: string) => {
		setDragOver(stageId);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDragOver(null);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent, targetStageId: string) => {
			e.preventDefault();
			setDragOver(null);
			const itemId = e.dataTransfer.getData("text/plain");
			const item = workflow.items.find((it) => it.id === itemId);
			if (!item) return;
			if (item.stage === targetStageId) return;
			if (allowDrop && !allowDrop(item, targetStageId)) return;
			onDropItem(itemId, targetStageId);
		},
		[workflow.items, allowDrop, onDropItem],
	);

	const gateStages = humanGateStageIds(workflow, activeFlow);
	const doneStages = doneStageIds(workflow, activeFlow);
	const stageCols = orderedStages(workflow, activeFlow).map((stage) => ({
		id: stage.id,
		label: stage.name,
		color: stagePresentation(stage).color,
		gate: gateStages.has(stage.id),
	}));

	const filterMap: Record<string, (item: Item) => boolean> = {
		all: () => true,
		attention: (it) => {
			const state = itemOperationalState(it, workflow, activeFlow);
			return state === "waiting" || state === "blocked";
		},
		running: (it) => itemOperationalState(it, workflow, activeFlow) === "running",
		queued: (it) => itemOperationalState(it, workflow, activeFlow) === "idle",
		done: (it) => doneStages.has(it.stage),
	};
	const activeFilter = filterMap[filter] || filterMap.all;
	const visibleItems = workflow.items.filter(activeFilter);
	const emptyState = emptyStateForFilter(filter);

	function renderColumn(col: (typeof stageCols)[0]) {
		const items = workflow.items.filter((it) => it.stage === col.id).filter(activeFilter);
		const isOver = dragOver === col.id;
		const isHumanGate = col.gate;
		const hasAnyItems = workflow.items.some((it) => it.stage === col.id);

		return (
			<div
				key={col.id}
				className="flex min-h-[200px] w-[18rem] min-w-[18rem] flex-none flex-col gap-2 xl:w-[19.5rem] xl:min-w-[19.5rem]"
			>
				<div
					className="app-board-column-header flex items-center justify-between px-1 pb-1"
					data-gate={isHumanGate && hasAnyItems ? "true" : "false"}
				>
					<div className="flex min-w-0 items-center gap-2">
						{isHumanGate && hasAnyItems ? (
							<div className="w-2 h-4 rounded-full bg-[var(--color-success)] animate-timeline-dot" />
						) : (
							<div
								className="w-1.5 h-4 rounded-full"
								style={{ background: col.color }}
							/>
						)}
						<span
							className={cn(
								"min-w-0 truncate text-xs font-semibold",
								isHumanGate && hasAnyItems && "text-[var(--color-success)]",
							)}
						>
							{col.label}
						</span>
						<Badge
							variant={isHumanGate && hasAnyItems ? "amber" : "info"}
							className={cn(
								"shrink-0 text-caption px-1.5",
								isHumanGate && hasAnyItems && "animate-pulse",
							)}
						>
							{workflow.items.filter((it) => it.stage === col.id).length}
						</Badge>
					</div>
				</div>

				<div
					className="app-board-dropzone flex flex-col gap-2 p-2"
					data-over={isOver ? "true" : "false"}
					data-gate={isHumanGate && hasAnyItems ? "true" : "false"}
					onDragOver={handleDragOver}
					onDragEnter={() => handleDragEnter(col.id)}
					onDragLeave={handleDragLeave}
					onDrop={(e) => handleDrop(e, col.id)}
				>
					{items.length === 0 && !isOver && (
						<div className="flex items-center justify-center h-full py-4">
							<span className="app-board-empty text-[11px]">Vazio</span>
						</div>
					)}

					{items.map((item) => (
						<ItemCard
							key={item.id}
							item={item}
							workflow={workflow}
							activeFlow={activeFlow}
							specs={specs}
							onClick={() => onSelectItem(item.id)}
							onDragStart={(e) => handleDragStart(e, item.id)}
							onDragEnd={handleDragEnd}
						/>
					))}

					{isHumanGate && hasAnyItems && (
						<div className="app-board-gate-banner mt-1 pt-2">
							<div className="flex items-center gap-2 text-caption mb-1.5 px-1">
								<Icon
									name="clock"
									size={10}
									style={{ color: "var(--color-success)" }}
								/>
								<span
									style={{ color: "var(--color-success)" }}
									className="font-medium"
								>
									Aprovação necessária
								</span>
							</div>
							{items.map((item) => (
								<div key={item.id} className="mb-2">
									<GateDecisionActions
										itemId={item.id}
										onDecided={onItemDecided}
									/>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4", className)}>
			{visibleItems.length === 0 ? (
				<div className="app-board-filter-empty flex min-h-[16rem] flex-1 flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-6 text-center">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-sunken)] text-[var(--color-text-secondary)]">
						<Icon
							name={
								filter === "attention"
									? "shield"
									: filter === "running"
										? "cpu"
										: filter === "done"
											? "check-circle"
											: "circle"
							}
							size={18}
						/>
					</div>
					<div className="grid max-w-sm gap-1">
						<p className="text-body-sm font-semibold text-[var(--color-text-primary)]">
							{emptyState.title}
						</p>
						<p className="text-caption leading-snug text-[var(--color-text-secondary)]">
							{emptyState.description}
						</p>
					</div>
				</div>
			) : (
				<div className="flex min-w-max gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
					{stageCols.map(renderColumn)}
				</div>
			)}
			{onAddItem && (
				<div className="flex justify-center">
					<Button variant="secondary" size="sm" onClick={onAddItem}>
						<Icon name="plus" size={14} />
						Adicionar item
					</Button>
				</div>
			)}
		</div>
	);
}
