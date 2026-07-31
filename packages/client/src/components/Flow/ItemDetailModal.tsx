import { useCallback, useEffect, useRef, useState } from "react";
import type { Item, ResolvedSpec, Workflow } from "@letra/types";
import {
	ActionPanel,
	Badge,
	Button,
	Card,
	CardContent,
	Checkbox,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	ConfirmDialog,
	Dialog,
	Icon,
	MetadataRow,
	Progress,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Tag,
	Markdown,
} from "@letra/ui";
import { cn } from "../../lib/utils";
import { createEventSourceWithReconnect } from "../../lib/withReconnect";
import { computeSlug, countACs } from "../../lib/item-utils";
import { translateTerm } from "../../lib/term-translations";
import {
	itemOperationalState,
	orderedStages,
	stageActionLabel,
	type ActiveFlowDefinition,
	type ActiveFlowStage,
	type OperationalState,
} from "../../lib/active-flow";

interface Props {
	item: Item;
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	specs: ResolvedSpec[];
	onClose: () => void;
	onItemMoved: () => void;
	onOpenSpec?: () => void;
}

interface ActivityEntry {
	id: string;
	timestamp: string;
	action: string;
	description: string;
}

function daysSince(iso: string): number {
	const created = new Date(iso).getTime();
	if (Number.isNaN(created)) return 0;
	return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function stateCopy(state: OperationalState): {
	label: string;
	action: string;
	tone: "default" | "warning" | "danger" | "success" | "info";
	badge: "amber" | "success" | "info" | "error" | "agent";
	icon: "check-circle" | "clock" | "chevron-right" | "shield" | "circle";
} {
	if (state === "waiting") return { label: "Aguardando decisão", action: "Revisar o gate antes de avançar.", tone: "warning", badge: "amber", icon: "clock" };
	if (state === "blocked") return { label: "Bloqueado", action: "Examinar a causa do bloqueio.", tone: "danger", badge: "error", icon: "shield" };
	if (state === "running") return { label: "Em execução", action: "Acompanhar o responsável e evidências.", tone: "info", badge: "agent", icon: "chevron-right" };
	if (state === "done") return { label: "Concluído", action: "Verificar evidências registradas.", tone: "success", badge: "success", icon: "check-circle" };
	return { label: "Na fila", action: "Avaliar prioridade e próximo responsável.", tone: "default", badge: "info", icon: "circle" };
}

export default function ItemDetailModal({
	item,
	workflow,
	activeFlow,
	specs,
	onClose,
	onItemMoved,
	onOpenSpec,
}: Props) {
	const modalRef = useRef<HTMLDialogElement>(null);
	const prevFocusRef = useRef<HTMLElement | null>(null);
	const [moveTarget, setMoveTarget] = useState("");
	const [sseWarning, setSseWarning] = useState<string | null>(null);
	const [specLoading, setSpecLoading] = useState(true);
	const [activities, setActivities] = useState<ActivityEntry[]>([]);
	const [activitiesLoaded, setActivitiesLoaded] = useState(false);
	const [showTimeline, setShowTimeline] = useState(false);
	const [showAdvancedActions, setShowAdvancedActions] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const slug = computeSlug(item, specs, workflow);
	const title = item.description?.trim() || slug;
	const resolvedStages = orderedStages(workflow, activeFlow);
	const curStage = resolvedStages.find((stage) => stage.id === item.stage);
	const linkedSpec = item.spec ? specs.find((s) => s.id === item.spec) : null;
	const acCount = linkedSpec ? countACs(linkedSpec.content) : null;
	const hasTasks = item.tasks && item.tasks.length > 0;
	const progressMax = acCount ? acCount.total : hasTasks ? item.tasks!.length : 0;
	const progressVal = acCount ? acCount.done : hasTasks ? item.tasks!.filter((task) => task.done).length : 0;
	const daysInFlow = daysSince(item.createdAt);
	const state = itemOperationalState(item, workflow, activeFlow);
	const stateUi = stateCopy(state);
	const stageAction = curStage ? stageActionLabel(curStage) : "Item registrado no fluxo.";
	const owner = item.claimedBy ?? curStage?.roles[0]?.label ?? "Não atribuído";
	const availableStages = resolvedStages.filter((stage) => stage.id !== item.stage);

	useEffect(() => {
		prevFocusRef.current = document.activeElement as HTMLElement;
		modalRef.current?.focus();
		return () => {
			prevFocusRef.current?.focus();
		};
	}, []);

	useEffect(() => {
		const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		function handleKeyDown(event: KeyboardEvent) {
			const modal = modalRef.current;
			if (!modal) return;
			if (event.key === "Escape") {
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const elements = modal.querySelectorAll<HTMLElement>(focusable);
			if (elements.length === 0) return;
			const first = elements[0];
			const last = elements[elements.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	useEffect(() => {
		const eventSource = createEventSourceWithReconnect("/events");
		eventSource.addEventListener("workflow-updated", (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);
				if (data.itemId === item.id && data.stage && data.stage !== item.stage) {
					const newStage = resolvedStages.find((stage) => stage.id === data.stage);
					setSseWarning(`${item.id} movido para ${newStage?.name ?? data.stage}`);
					if (newStage?.zone === "done") {
						setTimeout(() => onClose(), 3000);
					}
				}
			} catch {
				// Ignore malformed event payloads.
			}
		});
		return () => eventSource.close();
	}, [item.id, item.stage, onClose, resolvedStages]);

	useEffect(() => {
		const timer = setTimeout(() => setSpecLoading(false), 150);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		fetch(`/api/log?item=${item.id}&limit=100`)
			.then((response) => response.json())
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
	}, [item.id, onClose, onItemMoved]);

	const handleTaskToggle = useCallback(
		(taskId: string, done: boolean) => {
			fetch(`/api/items/${item.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tasks: item.tasks?.map((task) => task.id === taskId ? { ...task, done } : task),
				}),
			}).then(() => onItemMoved());
		},
		[item.id, item.tasks, onItemMoved],
	);

	return (
		<>
			<Dialog
				open
				onClose={onClose}
				title={title}
				variant="fullscreen"
				hideHeader
				contentRef={modalRef}
				className="animate-fade-in"
			>
			{sseWarning && (
				<div className="app-warning-banner flex shrink-0 items-center gap-2 px-4 py-2 text-sm">
					<Icon name="alert-triangle" size={14} />
					<span>{sseWarning}</span>
					<Button onClick={() => setSseWarning(null)} className="ml-auto" size="sm" variant="ghost" aria-label="Dispensar aviso">
						<Icon name="x" size={14} />
					</Button>
				</div>
			)}

			<header className="app-header-surface flex shrink-0 items-start gap-3 px-5 py-4">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<Badge variant="info" tone="soft" className="font-mono">{item.id}</Badge>
						<Badge variant={stateUi.badge} tone="soft" icon={stateUi.icon}>{stateUi.label}</Badge>
						<Tag>{curStage?.name ?? item.stage}</Tag>
					</div>
					<h2 className="line-clamp-2 text-lg font-semibold leading-snug text-[var(--color-text-primary)]">{title}</h2>
					<p className="text-caption text-[var(--color-text-secondary)]">{item.spec ?? slug}</p>
				</div>
				{item.spec && onOpenSpec && (
					<Button size="sm" variant="secondary" onClick={onOpenSpec}>
						<Icon name="file-text" size={14} />
						Abrir especificação
					</Button>
				)}
				<Button onClick={onClose} size="sm" variant="ghost" aria-label="Fechar">
					<Icon name="x" size={16} />
				</Button>
			</header>

			<div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
				<aside className="app-section-card hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-none border-y-0 border-l-0 p-4 lg:flex">
					<ActionPanel
						tone={stateUi.tone}
						density="compact"
						icon={<Icon name={stateUi.icon} size={16} />}
						title="Próxima ação"
						description={`${stateUi.action} ${stageAction}`}
					/>

					<Card>
						<CardContent className="gap-3 p-4">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-body-sm font-semibold">Estado do trabalho</h3>
								<span className="text-caption tabular-nums text-[var(--color-text-secondary)]">
									{progressMax > 0 ? `${progressVal}/${progressMax}` : "sem checklist"}
								</span>
							</div>
							{progressMax > 0 && <Progress value={progressVal} max={progressMax} size="sm" state={state === "done" ? "complete" : state === "blocked" ? "error" : state === "waiting" ? "warning" : "default"} />}
							<MetadataRow
								className="grid-cols-1"
								items={[
									{ label: "Responsável", value: owner },
									{ label: "Tempo no fluxo", value: daysInFlow === 0 ? "Hoje" : `${daysInFlow}d` },
									{ label: "Evidência", value: linkedSpec ? linkedSpec.id : "Sem especificação vinculada" },
								]}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="gap-3 p-4">
							<h3 className="text-body-sm font-semibold">Movimentação</h3>
							<div className="flex items-center gap-2">
								<Select value={moveTarget} onValueChange={setMoveTarget}>
									<SelectTrigger className="app-select-surface flex-1 text-xs" aria-label="Mover para">
										<SelectValue placeholder="Mover para..." />
									</SelectTrigger>
									<SelectContent>
										{availableStages.map((stage) => (
											<SelectItem key={stage.id} value={stage.id}>
												{stage.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button size="sm" disabled={!moveTarget} onClick={handleMove}>Mover</Button>
							</div>
							{item.spec && onOpenSpec && (
								<Button size="sm" variant="secondary" onClick={onOpenSpec}>
									<Icon name="file-text" size={14} />
									Abrir especificação vinculada
								</Button>
							)}
							<Collapsible open={showAdvancedActions} onOpenChange={setShowAdvancedActions}>
								<CollapsibleTrigger className="app-section-muted flex w-full items-center gap-2 text-xs font-semibold">
									<Icon name="chevron-right" size={12} className={cn("transition-transform", showAdvancedActions && "rotate-90")} />
									Ações avançadas
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-2">
									<Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(true)} className="app-danger-text w-full justify-start">
										<Icon name="trash" size={14} />
										Excluir item
									</Button>
								</CollapsibleContent>
							</Collapsible>
						</CardContent>
					</Card>

					<EventLog activities={activities} loaded={activitiesLoaded} open={showTimeline} onOpenChange={setShowTimeline} />
				</aside>

				<main className="flex min-h-0 flex-col overflow-hidden">
					<div className="app-section-shell flex min-h-0 flex-1 overflow-y-auto p-5">
						<div className="mx-auto grid w-full max-w-5xl gap-4">
							<ActionPanel
								className="lg:hidden"
								tone={stateUi.tone}
								icon={<Icon name={stateUi.icon} size={18} />}
								title={stateUi.label}
								description={`${stateUi.action} ${stageAction}`}
								meta={
									<>
										<Tag>{owner}</Tag>
										<Tag>{daysInFlow === 0 ? "Hoje no fluxo" : `${daysInFlow}d no fluxo`}</Tag>
									</>
								}
								action={
									item.spec && onOpenSpec ? (
										<Button size="sm" variant="secondary" onClick={onOpenSpec}>
											<Icon name="file-text" size={14} />
											Abrir especificação
										</Button>
									) : null
								}
							/>

							{hasTasks && (
								<TaskList item={item} onToggle={handleTaskToggle} />
							)}

							<Card>
								<CardContent className="gap-4 p-5">
									<div className="flex items-center justify-between gap-2">
										<div>
											<h3 className="text-body-sm font-semibold">Evidência vinculada</h3>
											<p className="text-caption text-[var(--color-text-secondary)]">
												{linkedSpec ? linkedSpec.id : "Nenhuma especificação vinculada a este item."}
											</p>
										</div>
									</div>
									{specLoading ? (
										<div className="grid gap-3">
											<Skeleton className="h-6 w-48" />
											<Skeleton className="h-4 w-full" />
											<Skeleton className="h-4 w-3/4" />
											<Skeleton className="h-20 w-full" />
										</div>
									) : linkedSpec ? (
										<div className="max-w-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4">
											<Markdown content={linkedSpec.content} />
										</div>
									) : (
										<div className="flex min-h-48 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)]">
											<div className="grid justify-items-center gap-2 text-center">
												<Icon name="file-text" size={24} className="app-section-muted" />
												<p className="app-section-muted text-sm">
													{item.spec ? "Especificação não encontrada" : "Nenhuma especificação vinculada"}
												</p>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>
					</div>
				</main>
			</div>

			<div className="app-section-card flex shrink-0 items-center gap-2 rounded-none border-x-0 border-b-0 px-4 py-3 lg:hidden">
				<Select value={moveTarget} onValueChange={setMoveTarget}>
					<SelectTrigger className="app-select-surface flex-1 text-xs" aria-label="Mover para">
						<SelectValue placeholder="Mover para..." />
					</SelectTrigger>
					<SelectContent>
						{availableStages.map((stage) => (
							<SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button size="sm" disabled={!moveTarget} onClick={handleMove}>Mover</Button>
			</div>
			</Dialog>
			<ConfirmDialog
				open={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleDelete}
				title="Excluir item"
				message={`Excluir ${item.id} remove este item do fluxo. Esta ação deve ser usada apenas quando o item não representa mais trabalho real.`}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
				variant="danger"
			/>
		</>
	);
}

function TaskList({ item, onToggle }: { item: Item; onToggle: (taskId: string, done: boolean) => void }) {
	if (!item.tasks || item.tasks.length === 0) return null;
	return (
		<Card>
			<CardContent className="gap-3 p-4">
				<h3 className="text-body-sm font-semibold">
					Tarefas ({item.tasks.filter((task) => task.done).length}/{item.tasks.length})
				</h3>
				<div className="grid gap-1">
					{item.tasks.map((task) => (
						<label
							key={task.id}
							className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-xs hover:bg-[var(--surface-hover)]"
						>
							<Checkbox
								checked={task.done}
								onChange={(event) => onToggle(task.id, (event.target as HTMLInputElement).checked)}
							/>
							<span className={cn("text-[var(--color-text-primary)]", task.done && "text-[var(--color-text-secondary)] line-through")}>
								{task.description}
							</span>
						</label>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function EventLog({
	activities,
	loaded,
	open,
	onOpenChange,
}: {
	activities: ActivityEntry[];
	loaded: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Card>
			<CardContent className="gap-3 p-4">
				<Collapsible open={open} onOpenChange={onOpenChange}>
					<CollapsibleTrigger className="app-section-muted flex w-full items-center gap-2 text-xs font-semibold">
						<Icon name="chevron-right" size={12} className={cn("transition-transform", open && "rotate-90")} />
						Log de eventos
						{loaded && (
							<span className="text-caption font-normal">({activities.length})</span>
						)}
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-3">
						<div className="grid max-h-72 gap-2 overflow-y-auto">
							{!loaded ? (
								<p className="app-section-muted text-xs">Carregando...</p>
							) : activities.length === 0 ? (
								<p className="app-section-muted text-xs">Nenhum evento registrado para este item.</p>
							) : (
								activities.map((entry) => (
									<div key={entry.id} className="grid gap-0.5 border-l-2 border-[var(--color-primary)] pl-2">
										<div className="flex items-baseline gap-2">
											<span className="app-primary-text text-caption font-medium uppercase">
												{entry.action}
											</span>
											<span className="app-section-muted text-caption">
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
			</CardContent>
		</Card>
	);
}
