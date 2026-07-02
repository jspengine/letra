import { useCallback, useEffect, useRef, useState } from "react";
import type { Item, ResolvedSpec, Workflow } from "@letra/types";
import { Badge, Button, Checkbox, Dialog, Icon, Progress, Skeleton, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@letra/ui";
import { Markdown } from "../ui/markdown";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@letra/ui";
import { cn } from "../../lib/utils";
import { computeSlug, computeTypeTag, countACs, TYPE_COLORS, stageName } from "../../lib/item-utils";
import {
	orderedStages,
	type ActiveFlowDefinition,
	type ActiveFlowStage,
} from "../../lib/active-flow";

interface Props {
	item: Item;
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	specs: ResolvedSpec[];
	onClose: () => void;
	onItemMoved: () => void;
	onTabChange?: (tab: "specs") => void;
}

const slugCache = new Map<string, string>();
const typeCache = new Map<string, string>();

function cachedSlug(item: Item, specs: ResolvedSpec[], workflow: Workflow): string {
	const cached = slugCache.get(item.id);
	if (cached) return cached;
	const slug = computeSlug(item, specs, workflow);
	slugCache.set(item.id, slug);
	return slug;
}

function cachedType(item: Item): string {
	const cached = typeCache.get(item.id);
	if (cached) return cached;
	const type = computeTypeTag(item);
	typeCache.set(item.id, type);
	return type;
}

export default function ItemDetailModal({
	item,
	workflow,
	activeFlow,
	specs,
	onClose,
	onItemMoved,
	onTabChange,
}: Props) {
	const modalRef = useRef<HTMLDialogElement>(null);
	const prevFocusRef = useRef<HTMLElement | null>(null);
	const [moveTarget, setMoveTarget] = useState("");
	const [sseWarning, setSseWarning] = useState<string | null>(null);
	const [specLoading, setSpecLoading] = useState(true);
	const [activities, setActivities] = useState<{ id: string; timestamp: string; action: string; description: string }[]>([]);
	const [activitiesLoaded, setActivitiesLoaded] = useState(false);
	const [showTimeline, setShowTimeline] = useState(false);

	const slug = cachedSlug(item, specs, workflow);
	const typeTag = cachedType(item);
	const typeColor = TYPE_COLORS[typeTag as keyof typeof TYPE_COLORS] ?? "var(--primary)";
	const resolvedStages = orderedStages(workflow, activeFlow);
	const curStage = resolvedStages.find((stage) => stage.id === item.stage);
	const linkedSpec = item.spec ? specs.find((s) => s.id === item.spec) : null;
	const acCount = linkedSpec ? countACs(linkedSpec.content) : null;
	const daysInStage = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
	const hasTasks = item.tasks && item.tasks.length > 0;
	const progressMax = acCount ? acCount.total : hasTasks ? item.tasks!.length : 0;
	const progressVal = acCount ? acCount.done : hasTasks ? item.tasks!.filter((t) => t.done).length : 0;

	useEffect(() => {
		prevFocusRef.current = document.activeElement as HTMLElement;
		modalRef.current?.focus();
		return () => {
			prevFocusRef.current?.focus();
		};
	}, []);

	// Focus trap
	useEffect(() => {
		const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		function handleKeyDown(e: KeyboardEvent) {
			const modal = modalRef.current;
			if (!modal) return;
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key !== "Tab") return;
			const els = modal.querySelectorAll<HTMLElement>(focusable);
			if (els.length === 0) return;
			const first = els[0];
			const last = els[els.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	// SSE listener for workflow-updated
	useEffect(() => {
		const evtSource = new EventSource("/api/events");
		evtSource.addEventListener("workflow-updated", (e: MessageEvent) => {
			try {
				const data = JSON.parse(e.data);
				if (data.itemId === item.id && data.stage && data.stage !== item.stage) {
					const newStage = resolvedStages.find((stage) => stage.id === data.stage);
					setSseWarning(
						`📦 ${item.id} movido para ${newStage?.name ?? data.stage}`,
					);
					if (newStage?.zone === "done") {
						setTimeout(() => onClose(), 3000);
					}
				}
			} catch {
				// ignore parse errors
			}
		});
		return () => evtSource.close();
	}, [activeFlow, item.id, item.stage, workflow, onClose]);

	// Spec loading simulation
	useEffect(() => {
		const t = setTimeout(() => setSpecLoading(false), 150);
		return () => clearTimeout(t);
	}, []);

	// Load log entries from session-log
	useEffect(() => {
		fetch(`/api/log?item=${item.id}&limit=100`)
			.then((r) => r.json())
			.then((data) => {
				if (data.entries) setActivities(data.entries);
			})
			.catch(() => {})
			.finally(() => setActivitiesLoaded(true));
	}, [item.id]);

	const handleMove = useCallback(() => {
		if (!moveTarget) return;
		fetch(`/api/items/${item.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: moveTarget }),
		}).then(() => {
			onItemMoved();
			setMoveTarget("");
		});
	}, [item.id, moveTarget, onItemMoved]);

	const handleDelete = useCallback(() => {
		fetch(`/api/items/${item.id}`, { method: "DELETE" }).then(() => {
			onItemMoved();
			onClose();
		});
	}, [item.id, onItemMoved, onClose]);

	const handleTaskToggle = useCallback(
		(taskId: string, done: boolean) => {
			fetch(`/api/items/${item.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tasks: item.tasks?.map((t) =>
						t.id === taskId ? { ...t, done } : t,
					),
				}),
			}).then(() => onItemMoved());
		},
		[item.id, item.tasks, onItemMoved],
	);

	const availableStages = resolvedStages.filter((stage) => stage.id !== item.stage);

	return (
		<Dialog
			open
			onClose={onClose}
			title={slug}
			variant="fullscreen"
			hideHeader
			contentRef={modalRef}
			className="animate-fade-in"
		>
				{/* SSE Warning Banner */}
				{sseWarning && (
					<div
						className="px-4 py-2 text-sm flex items-center gap-2 shrink-0"
						style={{
							background: "color-mix(in srgb, var(--warning) 15%, transparent)",
							color: "var(--warning)",
							borderBottom: "1px solid var(--border)",
						}}
					>
						<span>{sseWarning}</span>
						<Button
							onClick={() => setSseWarning(null)}
							className="ml-auto text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
						>
							✕
						</Button>
					</div>
				)}

				{/* Header */}
				<div
					className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
					style={{ borderColor: "var(--border)" }}
				>
					<h2 className="text-sm font-semibold">{slug}</h2>
					<Badge variant="secondary" className="text-[10px]">{curStage?.name ?? item.stage}</Badge>
					<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.id}</span>
					<div className="flex-1" />
					{item.spec && onTabChange && (
						<Button size="sm" variant="outline" onClick={() => onTabChange("specs")}>
							Abrir Spec
						</Button>
					)}
					<Button
						onClick={onClose}
						className="text-sm px-2 py-1 rounded hover:bg-muted/50 transition-colors"
						style={{ color: "var(--muted-foreground)" }}
						aria-label="Fechar"
					>
						✕
					</Button>
				</div>

				{/* Body: sidebar + spec */}
				<div className="flex flex-1 min-h-0">
					{/* Sidebar — desktop ~280px, mobile full width stacked */}
					<aside
						className="w-72 shrink-0 border-r overflow-y-auto hidden lg:flex flex-col"
						style={{ borderColor: "var(--border)", background: "var(--card)" }}
					>
						<div className="p-4 flex flex-col gap-4">
							{/* Type tag */}
							<div className="flex items-center gap-2">
								<span
									className="text-xs font-semibold px-2 py-0.5 rounded"
									style={{
										background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
										color: typeColor,
									}}
								>
									{typeTag}
								</span>
								<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
									{item.id}
								</span>
							</div>

							{/* Metadata */}
							<div className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
								<div className="flex justify-between">
									<span>Estágio</span>
									<Badge variant="secondary">{curStage?.name ?? item.stage}</Badge>
								</div>
								<div className="flex justify-between">
									<span>Progresso</span>
									<span>{progressVal}/{progressMax}</span>
								</div>
								<div className="flex justify-between">
									<span>Idade</span>
									<span>{daysInStage}d</span>
								</div>
								{item.claimedBy && (
									<div className="flex justify-between">
										<span>Responsável</span>
										<span>🤖 {item.claimedBy}</span>
									</div>
								)}
							</div>

							{/* Progress bar */}
							{progressMax > 0 && <Progress value={progressVal} max={progressMax} size="sm" />}

							<hr style={{ borderColor: "var(--border)" }} />

							{/* Actions */}
							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-2">
									<Select value={moveTarget} onValueChange={(value) => setMoveTarget(value)}>
								<SelectTrigger className="flex-1 text-xs px-2 py-1.5 rounded border" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} aria-label="Mover para">
									<SelectValue placeholder="Mover para…" />
								</SelectTrigger>
								<SelectContent>
									{availableStages.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											{s.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
									<Button size="sm" disabled={!moveTarget} onClick={handleMove}>
										Mover
									</Button>
								</div>
								{item.spec && onTabChange && (
									<Button size="sm" variant="outline" onClick={() => onTabChange("specs")}>
										<Icon name="file-text" size={14} className="mr-1" />
										Editar spec
									</Button>
								)}

								<Button size="sm" variant="outline" onClick={handleDelete} style={{ color: "var(--error)" }}>
									Excluir
								</Button>
							</div>

							<hr style={{ borderColor: "var(--border)" }} />

							{/* Log de Eventos — collapsible */}
							<Collapsible open={showTimeline} onOpenChange={setShowTimeline}>
								<CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold group" style={{ color: "var(--muted-foreground)" }}>
									<Icon
										name="chevron-right"
										size={12}
										className={cn("transition-transform", showTimeline && "rotate-90")}
									/>
									Log de Eventos
									{activitiesLoaded && (
										<span className="text-[10px] font-normal" style={{ color: "var(--muted-foreground)" }}>
											({activities.length})
										</span>
									)}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-2">
									<div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
										{!activitiesLoaded ? (
											<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
												Carregando…
											</p>
										) : activities.length === 0 ? (
											<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
												Nenhum evento registrado para este item.
											</p>
										) : (
											activities.map((entry) => (
												<div key={entry.id} className="flex flex-col gap-0.5 pl-2 border-l-2" style={{ borderColor: "var(--primary)" }}>
													<div className="flex items-baseline gap-2">
														<span className="text-[10px] font-medium uppercase shrink-0" style={{ color: "var(--primary)" }}>
															{entry.action}
														</span>
														<span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
															{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
														</span>
													</div>
													<p className="text-xs leading-relaxed">{entry.description}</p>
												</div>
											))
										)}
									</div>
								</CollapsibleContent>
							</Collapsible>
						</div>
					</aside>

					{/* Mobile sidebar — collapsible accordion (shown < 1024px) */}
					<div className="lg:hidden w-full border-b shrink-0" style={{ borderColor: "var(--border)" }}>
						<MobileMeta
							item={item}
							slug={slug}
							typeTag={typeTag}
							typeColor={typeColor}
							curStageName={curStage?.name ?? item.stage}
							progressVal={progressVal}
							progressMax={progressMax}
							daysInStage={daysInStage}
							availableStages={availableStages}
							moveTarget={moveTarget}
							onMoveTargetChange={setMoveTarget}
							onMove={handleMove}
							onDelete={handleDelete}
							onTabChange={onTabChange}
							itemSpec={item.spec}
						/>
					</div>

					{/* Spec Area */}
					<main className="flex-1 flex flex-col min-h-0 overflow-hidden">
						{specLoading ? (
							<div className="p-6 flex flex-col gap-4">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3" />
							</div>
						) : linkedSpec ? (
							<div className="flex flex-col flex-1 min-h-0">
								<div
									className="flex-1 overflow-y-auto p-6"
									style={{ background: "var(--background)" }}
								>
									<Markdown content={linkedSpec.content} />
								</div>
							</div>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center flex flex-col gap-2">
									<Icon name="file-text" size={24} style={{ color: "var(--muted-foreground)" }} />
									<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
										{item.spec ? "Spec não encontrada" : "Nenhuma spec vinculada"}
									</p>
									{item.spec && (
										<Button size="sm" variant="outline" onClick={() => onTabChange?.("specs")}>
											Criar spec
										</Button>
									)}
								</div>
							</div>
						)}

						{/* Tasks section at bottom of spec area */}
						{hasTasks && (
							<div
								className="border-t p-4 shrink-0 max-h-48 overflow-y-auto"
								style={{ borderColor: "var(--border)", background: "var(--card)" }}
							>
								<span className="text-xs font-medium block mb-2" style={{ color: "var(--muted-foreground)" }}>
									Tasks ({item.tasks!.filter((t) => t.done).length}/{item.tasks!.length})
								</span>
								<div className="flex flex-col gap-1">
									{item.tasks!.map((task) => (
										<label
											key={task.id}
											className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
										>
											<Checkbox
												checked={task.done}
												onChange={(e) => handleTaskToggle(task.id, (e.target as HTMLInputElement).checked)}
											/>
											<span
												className={cn(task.done && "line-through")}
												style={{
													color: task.done ? "var(--muted-foreground)" : "var(--foreground)",
												}}
											>
												{task.description}
											</span>
										</label>
									))}
								</div>
							</div>
						)}
					</main>
				</div>

				{/* Mobile sticky action bar (< 640px) */}
				<div className="sm:hidden flex items-center gap-2 px-4 py-3 border-t shrink-0"
					style={{ borderColor: "var(--border)", background: "var(--card)" }}
				>
					<Select value={moveTarget} onValueChange={(value) => setMoveTarget(value)}>
					<SelectTrigger className="flex-1 text-xs px-2 py-2 rounded border" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} aria-label="Mover para">
						<SelectValue placeholder="Mover para…" />
					</SelectTrigger>
					<SelectContent>
						{availableStages.map((s) => (
							<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
						))}
					</SelectContent>
				</Select>
					<Button size="sm" disabled={!moveTarget} onClick={handleMove}>Mover</Button>
					{item.spec && onTabChange && (
						<Button size="sm" variant="outline" onClick={() => onTabChange("specs")}>
							<Icon name="file-text" size={14} />
						</Button>
					)}
				</div>
		</Dialog>
	);
}

interface MobileMetaProps {
	item: Item;
	slug: string;
	typeTag: string;
	typeColor: string;
	curStageName: string;
	progressVal: number;
	progressMax: number;
	daysInStage: number;
	availableStages: ActiveFlowStage[];
	moveTarget: string;
	onMoveTargetChange: (v: string) => void;
	onMove: () => void;
	onDelete: () => void;
	onTabChange?: (tab: "specs") => void;
	itemSpec?: string;
}

function MobileMeta({
	item,
	slug,
	typeTag,
	typeColor,
	curStageName,
	progressVal,
	progressMax,
	daysInStage,
	availableStages,
	moveTarget,
	onMoveTargetChange,
	onMove,
	onDelete,
	onTabChange,
	itemSpec,
}: MobileMetaProps) {
	return (
		<Collapsible>
			<CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium group"
				style={{ color: "var(--foreground)" }}
			>
				<Icon
					name="chevron-down"
					size={14}
					className="transition-transform group-data-[open]:rotate-180"
				/>
				Detalhes do item
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="px-4 pb-3 flex flex-col gap-3 text-xs">
					<div className="flex items-center gap-2">
						<span
							className="text-xs font-semibold px-2 py-0.5 rounded"
							style={{
								background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
								color: typeColor,
							}}
						>
							{typeTag}
						</span>
						<span style={{ color: "var(--muted-foreground)" }}>{item.id}</span>
					</div>
					<div className="flex flex-col gap-1" style={{ color: "var(--muted-foreground)" }}>
						<div className="flex justify-between">
							<span>Estágio</span>
							<Badge variant="secondary">{curStageName}</Badge>
						</div>
						<div className="flex justify-between">
							<span>Progresso</span>
							<span>{progressVal}/{progressMax}</span>
						</div>
						<div className="flex justify-between">
							<span>Idade</span>
							<span>{daysInStage}d</span>
						</div>
						{item.claimedBy && (
							<div className="flex justify-between">
								<span>Responsável</span>
								<span>🤖 {item.claimedBy}</span>
							</div>
						)}
					</div>
					{progressMax > 0 && <Progress value={progressVal} max={progressMax} size="sm" />}
					<div className="flex items-center gap-2">
						<Select value={moveTarget} onValueChange={(value) => onMoveTargetChange(value)}>
						<SelectTrigger className="flex-1 text-xs px-2 py-1.5 rounded border" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} aria-label="Mover para">
							<SelectValue placeholder="Mover para…" />
						</SelectTrigger>
						<SelectContent>
							{availableStages.map((s) => (
								<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
							))}
						</SelectContent>
					</Select>
						<Button
							onClick={onMove}
							disabled={!moveTarget}
							className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
							style={{ background: "var(--primary)", color: "white" }}
						>
							Mover
						</Button>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
