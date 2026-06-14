import { useEffect, useState } from "react";
import type { ResolvedSpec, Workflow } from "@letra/types";
import { Card, CardContent } from "@letra/ui";
import { Badge, Icon, Progress } from "@letra/ui";
import { cn } from "../../lib/utils";

interface Props {
	workflow: Workflow;
	onSelectItem: (id: string) => void;
	onItemMoved: () => void;
	onDropItem?: (itemId: string, targetStageId: string) => void;
	allowMoveToStage?: (item: Workflow["items"][0], targetStageId: string) => boolean;
}

function daysSince(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysColor(d: number): string {
	if (d <= 2) return "var(--muted-foreground)";
	if (d <= 7) return "var(--warning)";
	return "var(--error)";
}

function daysIcon(d: number): "check-circle" | "alert-circle" | "x-circle" | null {
	if (d === 0) return "check-circle";
	if (d <= 2) return null;
	if (d <= 7) return "alert-circle";
	return "x-circle";
}

function daysLabel(d: number): string {
	if (d === 0) return "today";
	return `${d}d`;
}

export default function KanbanView({
	workflow,
	onSelectItem,
	onItemMoved,
	onDropItem,
	allowMoveToStage,
}: Props) {
	const [dragOver, setDragOver] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);

	useEffect(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
	}, []);

	function specStatus(itemId: string): "linked" | "valid" | null {
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item?.spec) return null;
		if (!workflow.specLinks?.[item.spec]) return null;
		const spec = specs.find((s) => s.id === item.spec);
		if (!spec) return "linked";
		const hasOutcome = /## Outcome/.test(spec.content);
		const hasConstraints = /## Constraints/.test(spec.content);
		const hasAC = /## Acceptance Criteria/.test(spec.content);
		return hasOutcome && hasConstraints && hasAC ? "valid" : "linked";
	}

	function specBadge(itemId: string) {
		const status = specStatus(itemId);
		if (!status) return null;
		return (
			<Badge variant={status === "valid" ? "success" : "warning"} className="shrink-0">
				<Icon name={status === "valid" ? "check-circle" : "alert-circle"} size={12} />
				<span className="ml-1">Spec</span>
			</Badge>
		);
	}

	function handleDragStart(e: React.DragEvent, itemId: string) {
		e.dataTransfer.setData("text/plain", itemId);
		e.dataTransfer.effectAllowed = "move";
		setDraggingId(itemId);
	}

	function handleDragEnd() {
		setDraggingId(null);
		setDragOver(null);
	}

	function handleDragOver(e: React.DragEvent, stageId: string) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	function handleDragEnter(stageId: string) {
		setDragOver(stageId);
	}

	function handleDragLeave() {
		setDragOver(null);
	}

	function handleDrop(e: React.DragEvent, targetStageId: string) {
		e.preventDefault();
		setDragOver(null);
		setDraggingId(null);
		const itemId = e.dataTransfer.getData("text/plain");
		if (!itemId) return;
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item || item.stage === targetStageId) return;

		if (allowMoveToStage && !allowMoveToStage(item, targetStageId)) return;

		if (onDropItem) {
			onDropItem(itemId, targetStageId);
		} else {
			fetch(`/api/items/${itemId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stage: targetStageId }),
			}).then(() => onItemMoved());
		}
	}

	function tasksBar(itemId: string) {
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item?.tasks || item.tasks.length === 0) return null;
		const done = item.tasks.filter((t) => t.done).length;
		const stage = workflow.stages.find((s) => s.id === item.stage);
		return (
			<Progress
				value={done}
				max={item.tasks.length}
				size="xs"
				showValue
				barColor={stage?.color}
			/>
		);
	}

	return (
		<div className="flex h-full gap-3 p-3 overflow-x-auto">
			{workflow.stages.map((stage) => {
				const stageItems = workflow.items.filter((it) => it.stage === stage.id);
				const isOver = dragOver === stage.id;
				const isOverDenied =
					isOver && draggingId && allowMoveToStage
						? !allowMoveToStage(
								workflow.items.find((it) => it.id === draggingId)!,
								stage.id,
							)
						: false;
				const accentBorder = stage.color ? `2px solid ${stage.color}40` : undefined;
				const accentHeader = stage.color ? stage.color : undefined;
				return (
					<Card
						key={stage.id}
						className={cn(
							"flex-1 min-w-[220px] transition-all border-muted/60",
							isOver && !isOverDenied && "ring-2 ring-primary/50 border-primary",
							isOverDenied && "ring-2 ring-red-500/50 border-red-500 opacity-60",
						)}
						style={accentBorder ? { borderTop: accentBorder } : undefined}
						onDragOver={(e) => handleDragOver(e, stage.id)}
						onDragEnter={() => handleDragEnter(stage.id)}
						onDragLeave={handleDragLeave}
						onDrop={(e) => handleDrop(e, stage.id)}
					>
						<CardContent className="p-3">
							<h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
								{accentHeader && (
									<span
										className="w-2 h-2 rounded-full shrink-0"
										style={{ background: accentHeader }}
									/>
								)}
								{stage.name}
								<span
									className="text-xs font-normal"
									style={{ color: "var(--muted-foreground)" }}
								>
									{stageItems.length}
								</span>
							</h3>
							<div className="flex flex-col gap-2 min-h-[60px]">
								{stageItems.length === 0 && (
									<p
										className="text-xs"
										style={{ color: "var(--muted-foreground)" }}
									>
										(empty)
									</p>
								)}
								{stageItems.map((it) => {
									const days = daysSince(it.createdAt);
									const icon = daysIcon(days);
									return (
										<div
											key={it.id}
											draggable="true"
											onClick={() => onSelectItem(it.id)}
											onDragStart={(e) => handleDragStart(e, it.id)}
											onDragEnd={handleDragEnd}
											className={cn(
												"rounded-lg border text-card-foreground transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-sm hover:-translate-y-0.5",
												draggingId === it.id && "opacity-40",
												stage.color
													? "bg-card/90 hover:border-transparent"
													: "bg-card hover:border-primary/20",
											)}
											style={{
												borderColor: stage.color
													? `${stage.color}30`
													: "var(--border)",
												background: stage.color
													? `color-mix(in srgb, ${stage.color}08, var(--card))`
													: undefined,
												boxShadow:
													draggingId === it.id
														? undefined
														: stage.color
															? `0 1px 3px ${stage.color}15`
															: undefined,
											}}
										>
											<div className="p-2.5 flex flex-col gap-1.5">
												<div className="flex items-center justify-between gap-2">
													<span className="font-medium text-xs">
														{it.id}
													</span>
													<span
														className="flex items-center gap-1 text-xs tabular-nums shrink-0"
														style={{ color: daysColor(days) }}
													>
														{icon && <Icon name={icon} size={12} />}
														{daysLabel(days)}
													</span>
												</div>
												<div
													className="truncate text-xs leading-relaxed"
													style={{ color: "var(--muted-foreground)" }}
												>
													{it.description}
												</div>
												<div className="flex items-center gap-2 mt-0.5">
													{tasksBar(it.id)}
													{specBadge(it.id)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
