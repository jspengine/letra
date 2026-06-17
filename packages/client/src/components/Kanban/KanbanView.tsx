import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedSpec, Workflow } from "@letra/types";
import { Card, CardContent } from "@letra/ui";
import { Icon, Progress } from "@letra/ui";
import { cn } from "../../lib/utils";
import { MarchingBorder } from "./MarchingBorder";
import type { Item } from "@letra/types";
import { computeSlug, computeTypeTag, countACs, TYPE_COLORS, type ItemType } from "../../lib/item-utils";

interface Props {
	workflow: Workflow;
	onSelectItem: (id: string) => void;
	onItemMoved: () => void;
	onDropItem?: (itemId: string, targetStageId: string) => void;
	allowMoveToStage?: (item: Workflow["items"][0], targetStageId: string) => boolean;
	specRefreshKey?: number;
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

const slugCache = new Map<string, string>();
const typeCache = new Map<string, ItemType>();

function cachedSlug(item: Item, specs: ResolvedSpec[], workflow: Workflow): string {
	const cached = slugCache.get(item.id);
	if (cached) return cached;
	const slug = computeSlug(item, specs, workflow);
	slugCache.set(item.id, slug);
	return slug;
}

function cachedType(item: Item): ItemType {
	const cached = typeCache.get(item.id);
	if (cached) return cached;
	const type = computeTypeTag(item);
	typeCache.set(item.id, type);
	return type;
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}

export default function KanbanView({
	workflow,
	onSelectItem,
	onItemMoved,
	onDropItem,
	allowMoveToStage,
	specRefreshKey = 0,
}: Props) {
	const [dragOver, setDragOver] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [itemAlerts, setItemAlerts] = useState<Record<string, number>>({});
	const [focusItemId, setFocusItemId] = useState<string | null>(null);
	const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set());
	const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debouncedMove = useCallback(() => {
		if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
		moveTimerRef.current = setTimeout(() => onItemMoved(), 100);
	}, [onItemMoved]);

	function withLoading(key: string, fn: () => Promise<void>) {
		setLoadingButtons((prev) => new Set(prev).add(key));
		fn().finally(() => {
			setLoadingButtons((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		});
	}

	useEffect(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
		fetch("/api/items/alerts")
			.then((r) => r.json())
			.then((data) => {
				if (data?.itemAlerts) setItemAlerts(data.itemAlerts);
			})
			.catch(() => {});
		fetch("/api/focus")
			.then((r) => r.json())
			.then((data) => {
				if (data?.active && data?.itemId) setFocusItemId(data.itemId);
				else setFocusItemId(null);
			})
			.catch(() => {});
	}, [specRefreshKey]);

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
			const p = fetch(`/api/items/${itemId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stage: targetStageId }),
			});
			const releaseP = item.claimedBy && targetStageId === "review"
				? fetch(`/api/items/${itemId}/release`, { method: "POST" })
				: Promise.resolve();
			Promise.all([p, releaseP]).then(debouncedMove).catch(console.warn);
		}
	}

	return (
		<div className="flex flex-1 min-h-0 gap-3 p-3 overflow-x-auto">
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
									const isClaimed = !!it.claimedBy;
									const isFocused = focusItemId === it.id;
									const slug = cachedSlug(it, specs, workflow);
									const typeTag = cachedType(it);
									const typeColor = TYPE_COLORS[typeTag];
									const linkedSpec = it.spec ? specs.find((s) => s.id === it.spec) : null;
									const acCount = linkedSpec ? countACs(linkedSpec.content) : null;
									const hasTasks = it.tasks && it.tasks.length > 0;
									const progressMax = acCount ? acCount.total : hasTasks ? it.tasks!.length : 0;
									const progressVal = acCount ? acCount.done : hasTasks ? it.tasks!.filter((t) => t.done).length : 0;
									return (
										<div
											key={it.id}
											draggable="true"
											onClick={() => onSelectItem(it.id)}
											onDragStart={(e) => handleDragStart(e, it.id)}
											onDragEnd={handleDragEnd}
												className={cn(
													"relative group rounded-lg border text-card-foreground transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-sm hover:-translate-y-0.5",
													draggingId === it.id && "opacity-40",
													stage.color
														? "bg-card/90 hover:border-transparent"
														: "bg-card hover:border-primary/20",
												)}
												style={{
													borderColor: isClaimed
														? "transparent"
														: isFocused
															? "var(--border-focus)"
															: stage.color
																? `${stage.color}30`
																: "var(--border)",
													borderLeft: isFocused && !isClaimed ? "3px solid var(--border-focus)" : undefined,
													background: stage.color
														? `color-mix(in srgb, ${stage.color}08, var(--card))`
														: undefined,
												boxShadow: isClaimed
													? undefined
													: isFocused
														? `0 0 8px color-mix(in srgb, var(--border-focus) 30%, transparent)`
														: draggingId === it.id
															? undefined
															: stage.color
																? `0 1px 3px ${stage.color}15`
																: `0 1px 2px oklch(0 0 0 / 0.08)`,
												}}
										>
											{isClaimed && <MarchingBorder />}
											<div className="p-2.5 flex flex-col gap-1">
												<div className="flex items-center justify-between gap-1">
													<span
														className="font-medium text-xs truncate"
														title={`${it.id} — ${it.description}`}
													>
														{isFocused && (
															<span className="inline-block w-2 h-2 rounded-full mr-1 align-middle shrink-0"
																style={{ background: "var(--border-focus)" }}
															/>
														)}
														{slug}
													</span>
													<span
														className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 leading-none"
														style={{
															background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
															color: typeColor,
														}}
													>
														{typeTag}
													</span>
												</div>
												<div
													className="truncate text-xs leading-relaxed"
													style={{ color: "var(--muted-foreground)" }}
												>
													{truncate(it.description, 40)}
												</div>
												{(progressMax > 0) && (
													<Progress
														value={progressVal}
														max={progressMax}
														size="xs"
														showValue
														barColor={stage.color}
													/>
												)}
														<div className="flex items-center justify-between gap-1 mt-0.5">
													<div className="flex items-center gap-1.5 text-[10px]"
														style={{ color: "var(--muted-foreground)" }}
													>
														{itemAlerts[it.id] > 0 && (
															<span className="text-red-500 font-semibold" title={`${itemAlerts[it.id]} alerta(s)`}>
																⚠{itemAlerts[it.id]}
															</span>
														)}
														{it.spec && (
															<span title={it.spec}>📎{it.spec}</span>
														)}
													</div>
													<div className="flex items-center gap-1.5">
														{isClaimed && (
															<span title={`Em andamento por ${it.claimedBy} desde ${it.claimedAt ? new Date(it.claimedAt).toLocaleTimeString() : "?"}`}
																className="text-xs"
															>🤖</span>
														)}
														<span
															className="flex items-center gap-1 text-[10px] tabular-nums"
															style={{ color: daysColor(days) }}
														>
															{icon && <Icon name={icon} size={10} />}
															{daysLabel(days)}
														</span>
													</div>
												</div>
												<div className="hidden group-hover:flex items-center gap-1">
													{isFocused ? (
														<button
															className="text-[10px] px-1.5 py-0.5 rounded"
															style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
															disabled={loadingButtons.has(`focus-${it.id}`)}
															onClick={(e) => {
																e.stopPropagation();
																withLoading(`focus-${it.id}`, async () => {
																	await fetch("/api/focus", { method: "DELETE" });
																	setFocusItemId(null);
																	debouncedMove();
																});
															}}
														>
															{loadingButtons.has(`focus-${it.id}`) ? "⏳" : "★ Focus"}
														</button>
													) : (
														<button
															className="text-[10px] px-1.5 py-0.5 rounded"
															style={{ background: "var(--border-focus)", color: "white" }}
															disabled={loadingButtons.has(`focus-${it.id}`)}
															onClick={(e) => {
																e.stopPropagation();
																withLoading(`focus-${it.id}`, async () => {
																	await fetch(`/api/items/${it.id}/focus`, { method: "POST" });
																	setFocusItemId(it.id);
																	debouncedMove();
																});
															}}
														>
															{loadingButtons.has(`focus-${it.id}`) ? "⏳" : "☆ Focus"}
														</button>
													)}
													{isClaimed ? (
														<button
															className="text-[10px] px-1.5 py-0.5 rounded"
															style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
															disabled={loadingButtons.has(`release-${it.id}`)}
															onClick={(e) => {
																e.stopPropagation();
																withLoading(`release-${it.id}`, async () => {
																	await fetch(`/api/items/${it.id}/release`, { method: "POST" });
																	debouncedMove();
																});
															}}
														>
															{loadingButtons.has(`release-${it.id}`) ? "⏳" : "Release"}
														</button>
													) : (
														<button
															className="text-[10px] px-1.5 py-0.5 rounded"
															style={{ background: "var(--primary)", color: "white" }}
															disabled={loadingButtons.has(`claim-${it.id}`)}
															onClick={(e) => {
																e.stopPropagation();
																withLoading(`claim-${it.id}`, async () => {
																	await fetch(`/api/items/${it.id}/claim`, { method: "POST" });
																	debouncedMove();
																});
															}}
														>
															{loadingButtons.has(`claim-${it.id}`) ? "⏳" : "Claim"}
														</button>
													)}
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
