import { useState, useCallback, useRef, useEffect } from "react";
import type { ResolvedSpec, Workflow, Item } from "@letra/types";
import { Badge, Icon, Button, Progress, Tooltip } from "@letra/ui";
import { cn } from "../../lib/utils";
import { computeSlug, TYPE_COLORS } from "../../lib/item-utils";
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

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	onSelectItem: (id: string) => void;
	onDropItem: (itemId: string, targetStageId: string) => void;
	onApproveGate?: (gateId: string) => void;
	allowDrop?: (item: Workflow["items"][0], targetStageId: string) => boolean;
	specRefreshKey?: number;
	onAddItem?: () => void;
	filter?: string;
}

function computeItemState(state: OperationalState): {
	label: string;
	color: string;
	icon: "check-circle" | "clock" | "chevron-right" | "shield" | "circle";
	animate: string;
} {
	if (state === "done") return { label: "Concluído", color: "var(--success)", icon: "check-circle", animate: "" };
	if (state === "waiting") return { label: "Aguardando humano", color: "var(--gate-available)", icon: "clock", animate: "animate-timeline-dot" };
	if (state === "blocked") return { label: "Bloqueado", color: "var(--gate-blocked)", icon: "shield", animate: "" };
	if (state === "running") return { label: "Em execução", color: "var(--primary)", icon: "chevron-right", animate: "animate-agent-running" };
	return { label: "Na fila", color: "var(--muted-foreground)", icon: "circle", animate: "" };
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
	const typeTag = item.id.startsWith("BUG") ? "BUG"
		: item.id.startsWith("CHORE") ? "CHORE"
		: item.id.startsWith("DOCS") ? "DOCS"
		: "FEAT" as const;
	const typeColor = TYPE_COLORS[typeTag];
	const daysInStage = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
	const isHumanGate = humanGateStageIds(workflow, activeFlow).has(item.stage);
	const doneStages = doneStageIds(workflow, activeFlow);
	const state = computeItemState(itemOperationalState(item, workflow, activeFlow));

	const linkedSpec = item.spec ? specs.find((s) => s.id === item.spec) : null;
	const acProgress = linkedSpec ? (() => {
		const acDone = (linkedSpec.content.match(/-\s+\[x\]/g) || []).length;
		const acTotal = (linkedSpec.content.match(/-\s+\[(\s|x)\]/g) || []).length;
		return acTotal > 0 ? Math.round((acDone / acTotal) * 100) : 0;
	})() : item.tasks && item.tasks.length > 0
		? Math.round((item.tasks.filter((t) => t.done).length / item.tasks.length) * 100)
		: 0;

	const resolvedStage = orderedStages(workflow, activeFlow).find((stage) => stage.id === item.stage);
	const agentName = item.claimedBy ?? resolvedStage?.roles[0]?.label ?? "Não atribuído";
	const agentAction = resolvedStage ? stageActionLabel(resolvedStage) : "Processando";
	const isRunning = state.label === "Running" || state.label === "AI Review";

	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all duration-150 select-none bg-card hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
				isHumanGate && "animate-human-pulse",
				item.claimedBy && "ring-1",
				isRunning && "bg-gradient-to-r from-card to-primary/[0.02]",
			)}
			style={{
				borderColor: item.claimedBy ? "var(--live)" : isHumanGate ? "var(--gate-available)" : "var(--border)",
			}}
			draggable
			role="button"
			tabIndex={0}
			aria-label={`Abrir ${item.id}: ${slug}`}
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
			<div className="flex items-center gap-1.5">
				<Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono shrink-0" style={{ color: typeColor, borderColor: `${typeColor}40` }}>
					{typeTag}
				</Badge>
				<span className="text-[10px] font-mono truncate flex-1" style={{ color: "var(--foreground)" }}>{slug}</span>
				<Badge variant="secondary" className={cn("text-[8px] px-1 py-0 shrink-0 gap-0.5", state.animate)} style={{ color: state.color, borderColor: `${state.color}40` }}>
					<Icon name={state.icon} size={10} />
					{state.label}
				</Badge>
			</div>

			<div className="flex items-center gap-1.5">
				<div aria-hidden="true" className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[7px] font-bold" style={{ background: `color-mix(in oklch, var(--primary) 15%, transparent)`, color: "var(--primary)" }}>
					{agentName.charAt(0).toUpperCase()}
				</div>
				<span className="text-[9px] font-medium truncate">{agentName}</span>
				<span className="text-[8px] truncate" style={{ color: "var(--muted-foreground)" }}>{agentAction}</span>
				{isRunning && (
					<span className="w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse shrink-0" />
				)}
			</div>

			<div className="flex items-center gap-1">
				<Progress value={acProgress} max={100} size="xs" className="flex-1" />
				<span className="text-[8px] tabular-nums font-medium shrink-0" style={{ color: state.label === "Done" ? "var(--success)" : acProgress > 0 ? "var(--foreground)" : "var(--muted-foreground)" }}>
					{state.label === "Done" ? "100%" : acProgress > 0 ? `${acProgress}%` : "0%"}
				</span>
				{isRunning && (
					<span className="text-[7px] tabular-nums shrink-0" style={{ color: "var(--muted-foreground)" }}>
						idade {daysInStage === 0 ? "hoje" : `${daysInStage}d`}
					</span>
				)}
			</div>
		</div>
	);
}

export default function KanbanBoard({
	workflow,
	activeFlow,
	onSelectItem,
	onDropItem,
	onApproveGate,
	allowDrop,
	specRefreshKey,
	onAddItem,
	filter = "all",
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
		} catch { /* ignore */ }
	}, []);

	useEffect(() => { loadSpecs(); }, [loadSpecs]);
	useEffect(() => { if (specRefreshKey) loadSpecs(); }, [specRefreshKey, loadSpecs]);

	const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item) return;
		dragItem.current = item;
		setDraggingId(itemId);
		e.dataTransfer.setData("text/plain", itemId);
		e.dataTransfer.dropEffect = "move";
	}, [workflow.items]);

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

	const handleDrop = useCallback((e: React.DragEvent, targetStageId: string) => {
		e.preventDefault();
		setDragOver(null);
		const itemId = e.dataTransfer.getData("text/plain");
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item) return;
		if (item.stage === targetStageId) return;
		if (allowDrop && !allowDrop(item, targetStageId)) return;
		onDropItem(itemId, targetStageId);
	}, [workflow.items, allowDrop, onDropItem]);

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
		running: (it) => Boolean(it.claimedBy) && !gateStages.has(it.stage) && !doneStages.has(it.stage),
		waiting: (it) => gateStages.has(it.stage),
		blocked: (it) => itemOperationalState(it, workflow, activeFlow) === "blocked",
		error: () => false,
		done: (it) => doneStages.has(it.stage),
	};
	const activeFilter = filterMap[filter] || filterMap.all;

	function renderColumn(col: typeof stageCols[0]) {
		const items = workflow.items
			.filter((it) => it.stage === col.id)
			.filter(activeFilter);
		const isOver = dragOver === col.id;
		const isHumanGate = col.gate;
		const hasItems = items.length > 0;
		const hasAnyItems = workflow.items.filter((it) => it.stage === col.id).length > 0;

		return (
			<div key={col.id} className="flex flex-col gap-2 min-w-0 min-h-[200px]">
				<div className={cn(
					"flex items-center justify-between px-1 pb-1 border-b",
					isHumanGate && hasAnyItems && "border-b-2",
				)}
					style={{
						borderColor: isHumanGate && hasAnyItems ? "var(--gate-available)" : "var(--border)",
					}}
				>
					<div className="flex items-center gap-2">
						{isHumanGate && hasAnyItems ? (
							<div className="w-2 h-4 rounded-full bg-[var(--gate-available)] animate-timeline-dot" />
						) : (
							<div className="w-1.5 h-4 rounded-full" style={{ background: col.color }} />
						)}
						<span className={cn(
							"text-xs font-semibold",
							isHumanGate && hasAnyItems && "text-[var(--gate-available)]",
						)}>
							{col.label}
						</span>
						<Badge
							variant={isHumanGate && hasAnyItems ? "warning" : "secondary"}
							className={cn("text-[10px] px-1.5", isHumanGate && hasAnyItems && "animate-pulse")}
						>
							{hasAnyItems ? workflow.items.filter((it) => it.stage === col.id).length : 0}
						</Badge>
					</div>
				</div>

				<div
					className={cn(
						"flex flex-col gap-2 p-2 rounded-xl min-h-[100px] transition-all duration-150 border-2 border-dashed",
						isOver ? "border-primary/40 bg-primary/5" : "border-transparent",
						isHumanGate && hasAnyItems && "bg-[var(--gate-available)]/[0.04]",
					)}
					onDragOver={handleDragOver}
					onDragEnter={() => handleDragEnter(col.id)}
					onDragLeave={handleDragLeave}
					onDrop={(e) => handleDrop(e, col.id)}
				>
					{items.length === 0 && !isOver && (
						<div className="flex items-center justify-center h-full py-4">
							<span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
								Vazio
							</span>
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

					{isHumanGate && hasAnyItems && onApproveGate && (
						<div className="mt-1 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
							<div className="flex items-center gap-2 text-[10px] mb-1.5 px-1">
								<Icon name="clock" size={10} style={{ color: "var(--gate-available)" }} />
								<span style={{ color: "var(--gate-available)" }} className="font-medium">
									Aprovação necessária
								</span>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="w-full text-[10px]"
								style={{
									borderColor: "var(--gate-available)",
									color: "var(--gate-available)",
								}}
								onClick={() => onApproveGate(col.id)}
							>
								Aprovar todos
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4">
			<div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
				{stageCols.map(renderColumn)}
			</div>
			{onAddItem && (
				<div className="flex justify-center">
					<Button variant="outline" size="sm" onClick={onAddItem}>
						<Icon name="plus" size={14} />
						Adicionar item
					</Button>
				</div>
			)}
		</div>
	);
}
