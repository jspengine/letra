import { useCallback, useEffect, useState } from "react";
import type { ResolvedSpec, Workflow } from "@letra/types";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import KanbanBoard from "./KanbanBoard";
import ActivityTimeline from "./ActivityTimeline";
import ItemDetailModal from "./ItemDetailModal";
import { cn } from "../../lib/utils";
import {
	Button,
	ButtonGroup,
	ButtonGroupItem,
	Checkbox,
	Icon,
	Input,
	ConfirmDialog,
	PromptDialog,
	Dialog,
	Badge,
	Progress,
	Tooltip,
	Card,
	CardContent,
	NavHeader,
	ActionPanel,
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	Tag,
} from "@letra/ui";
import {
	doneStageIds,
	humanGateStageIds,
	itemOperationalState,
	nextStageId,
	orderedStages,
	pipelineProjection,
	stageActionLabel,
} from "../../lib/active-flow";

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	specRefreshKey?: number;
	onItemMoved: () => void;
	onOpenSpec?: () => void;
}

type WorkFilter = "all" | "attention" | "running" | "queued" | "done";

export default function FlowView({ workflow, activeFlow, specRefreshKey, onItemMoved, onOpenSpec }: Props) {
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [adminMode, setAdminMode] = useState<"stages" | "webhooks" | null>(null);
	const [editingStages, setEditingStages] = useState(workflow.stages);
	const [editingWebhooks, setEditingWebhooks] = useState(workflow.webhooks ?? []);
	const [validateDialogItem, setValidateDialogItem] = useState<{
		itemId: string;
		targetStage: string;
		pendingChecks: boolean[];
	} | null>(null);
	const [dragStageIdx, setDragStageIdx] = useState<number | null>(null);
	const [activeFilter, setActiveFilter] = useState<WorkFilter>("all");
	const humanGateStages = humanGateStageIds(workflow, activeFlow);
	const doneStages = doneStageIds(workflow, activeFlow);
	const resolvedStages = orderedStages(workflow, activeFlow);

	const loadSpecs = useCallback(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		loadSpecs();
	}, [loadSpecs, specRefreshKey]);
	useEffect(() => {
		function handleOpenItem(event: Event) {
			const detail = (event as CustomEvent<string>).detail;
			if (!detail) return;
			const itemExists = workflow.items.some((item) => item.id === detail);
			if (itemExists) setSelectedItemId(detail);
		}

		window.addEventListener("letra-open-item", handleOpenItem);
		return () => window.removeEventListener("letra-open-item", handleOpenItem);
	}, [workflow.items]);
	useEffect(() => {
		setEditingStages(workflow.stages);
	}, [workflow.stages]);
	useEffect(() => {
		setEditingWebhooks(workflow.webhooks ?? []);
	}, [workflow.webhooks]);
	const selectedItem = selectedItemId
		? workflow.items.find((it) => it.id === selectedItemId)
		: null;

	const selectedStage = selectedItem
		? resolvedStages.find((stage) => stage.id === selectedItem.stage)
		: null;

	const linkedSpec = selectedItem?.spec ? specs.find((s) => s.id === selectedItem.spec) : null;

	const upcomingStageId = selectedItem ? nextStageId(selectedItem.stage, workflow, activeFlow) : null;
	const nextStageName = upcomingStageId
		? resolvedStages.find((stage) => stage.id === upcomingStageId)?.name
		: null;

	function allowMoveToStage(item: Workflow["items"][0], targetStageId: string): boolean {
		const srcStage = workflow.stages.find((s) => s.id === item.stage);
		if (!srcStage || !srcStage.allow || srcStage.allow.length === 0) return true;
		if (!srcStage.allow.includes(targetStageId)) return false;
		if (humanGateStages.has(targetStageId)) return false;
		return true;
	}

	function getValidateChecks(item: Workflow["items"][0]): string[] {
		const srcStage = workflow.stages.find((s) => s.id === item.stage);
		return srcStage?.validate ?? [];
	}

	function doMoveItem(itemId: string, targetStage: string) {
		fetch(`/api/items/${itemId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: targetStage }),
		}).then(() => {
			onItemMoved();
			if (selectedItemId === itemId) setSelectedItemId(null);
		});
	}

	function handleDropItem(itemId: string, targetStage: string) {
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item || item.stage === targetStage) return;
		if (!allowMoveToStage(item, targetStage)) return;
		const validateChecks = getValidateChecks(item);
		if (validateChecks.length > 0) {
			setValidateDialogItem({
				itemId,
				targetStage,
				pendingChecks: validateChecks.map(() => false),
			});
			return;
		}
		doMoveItem(itemId, targetStage);
	}

	function handleMoveNext() {
		if (!selectedItem || !upcomingStageId) return;
		if (!allowMoveToStage(selectedItem, upcomingStageId)) return;
		const validateChecks = getValidateChecks(selectedItem);
		if (validateChecks.length > 0) {
			setValidateDialogItem({
				itemId: selectedItem.id,
				targetStage: upcomingStageId,
				pendingChecks: validateChecks.map(() => false),
			});
			return;
		}
		doMoveItem(selectedItem.id, upcomingStageId);
	}

	function handleValidateConfirm() {
		if (!validateDialogItem) return;
		doMoveItem(validateDialogItem.itemId, validateDialogItem.targetStage);
		setValidateDialogItem(null);
	}

	function handleDelete() {
		if (!selectedItem) return;
		fetch(`/api/items/${selectedItem.id}`, { method: "DELETE" }).then(() => {
			onItemMoved();
			setSelectedItemId(null);
		});
	}

	function handleTaskToggle(taskId: string, done: boolean) {
		if (!selectedItem) return;
		fetch(`/api/items/${selectedItem.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tasks: selectedItem.tasks?.map((t) => (t.id === taskId ? { ...t, done } : t)),
			}),
		}).then(() => onItemMoved());
	}

	function handleAddItem(name: string) {
		const firstStage = resolvedStages[0]?.id;
		if (!firstStage) return;
		fetch("/api/items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: name
					.trim()
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, ""),
				description: name.trim(),
				stage: firstStage,
			}),
		})
			.then((r) => r.json())
			.then((data) => {
				if (data && !data.error) onItemMoved();
			});
	}

	function handleSaveStages() {
		fetch("/api/workflow", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stages: editingStages }),
		})
			.then((r) => r.json())
			.then(() => {
				setAdminMode(null);
				onItemMoved();
			});
	}

	function handleUpdateStage(index: number, field: string, value: unknown) {
		setEditingStages((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	}

	function handleSaveWebhooks() {
		fetch("/api/workflow", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ webhooks: editingWebhooks }),
		})
			.then((r) => r.json())
			.then(() => {
				setAdminMode(null);
				onItemMoved();
			});
	}

	function handleAddWebhook() {
		const id = `wh-${Date.now()}`;
		setEditingWebhooks((prev) => [...prev, { id, url: "", events: ["item.moved"], label: "" }]);
	}

	function handleUpdateWebhook(index: number, field: string, value: unknown) {
		setEditingWebhooks((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	}

	function handleRemoveWebhook(index: number) {
		setEditingWebhooks((prev) => prev.filter((_, i) => i !== index));
	}

	function handleTestWebhook(index: number) {
		const wh = editingWebhooks[index];
		if (!wh?.url) return;
		fetch(wh.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				event: "test",
				workflow: workflow.name,
				timestamp: new Date().toISOString(),
				message: "Teste de webhook do Letra Flow",
			}),
		})
			.then((r) => {
				handleUpdateWebhook(index, "lastStatus", r.ok ? "ok" : "error");
				handleUpdateWebhook(index, "lastSentAt", new Date().toISOString());
			})
			.catch(() => {
				handleUpdateWebhook(index, "lastStatus", "error");
				handleUpdateWebhook(index, "lastSentAt", new Date().toISOString());
			});
	}

	function handleAddStage() {
		const id = `stage-${editingStages.length + 1}`;
		setEditingStages((prev) => [
			...prev,
			{
				id,
				name: `Stage ${editingStages.length + 1}`,
				order: prev.length,
				zone: "doing" as const,
			},
		]);
	}

	function handleRemoveStage(index: number) {
		setEditingStages((prev) => prev.filter((_, i) => i !== index));
	}

	function handleStageDragStart(index: number) {
		setDragStageIdx(index);
	}

	function handleStageDragOver(e: React.DragEvent, index: number) {
		e.preventDefault();
		if (dragStageIdx === null || dragStageIdx === index) return;
		setEditingStages((prev) => {
			const next = [...prev];
			const [moved] = next.splice(dragStageIdx, 1);
			next.splice(index, 0, moved);
			return next.map((s, i) => ({ ...s, order: i }));
		});
		setDragStageIdx(index);
	}

	function handleStageDragEnd() {
		setDragStageIdx(null);
	}

	const validMoveIcon = (itemId: string, stageId: string) => {
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item) return null;
		if (!allowMoveToStage(item, stageId))
			return (
				<span title="Transição não permitida">
					<Icon name="shield" size={12} />
				</span>
			);
		return null;
	};

	const totalItems = workflow.items.length;
	const itemStates = workflow.items.map((item) => ({
		item,
		state: itemOperationalState(item, workflow, activeFlow),
	}));
	const doneItems = itemStates.filter(({ state }) => state === "done").length;
	const pctComplete = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
	const activeAgents = workflow.items.filter((it) => it.claimedBy && !doneStages.has(it.stage)).length;
	const waitingHuman = itemStates.filter(({ state }) => state === "waiting").length;
	const blockedItems = itemStates.filter(({ state }) => state === "blocked").length;
	const attentionItems = waitingHuman + blockedItems;
	const runningItems = itemStates.filter(({ state }) => state === "running").length;
	const queuedItems = itemStates.filter(({ state }) => state === "idle").length;

	const pipelineStages = pipelineProjection(workflow, activeFlow).map((stage) => ({
		...stage,
		pct: stage.status === "done" ? 100 : 0,
		isRunning: stage.status === "running",
		isHumanGate: stage.presentation.isHumanGate,
	}));

	const currentStageIdx = pipelineStages.findIndex(
		(s) => s.itemCount > 0 && !doneStages.has(s.id) && s.zone !== "todo",
	);

	const agentItems = workflow.items
		.filter((it) => it.claimedBy)
		.reduce<Record<string, typeof workflow.items>>((acc, it) => {
			(acc[it.claimedBy!] = acc[it.claimedBy!] || []).push(it);
			return acc;
		}, {});

	const AGENT_COLORS = ["var(--color-primary)", "var(--color-warning)", "var(--color-primary)", "var(--color-success)", "var(--color-danger)"];

	const filterCounts = {
		all: totalItems,
		attention: attentionItems,
		running: runningItems,
		queued: queuedItems,
		done: doneItems,
	};
	const filterOptions: Array<{ key: WorkFilter; label: string }> = [
		{ key: "all", label: "Todos" },
		{ key: "attention", label: "Precisa de atenção" },
		{ key: "running", label: "Em andamento" },
		{ key: "queued", label: "Na fila" },
		{ key: "done", label: "Concluídos" },
	];
	const inAdminMode = adminMode !== null;
	const stagesEditMode = adminMode === "stages";
	const webhooksEditMode = adminMode === "webhooks";
	const primaryItem =
		workflow.items.find((item) => humanGateStages.has(item.stage)) ??
		workflow.items.find((item) => itemOperationalState(item, workflow, activeFlow) === "blocked") ??
		workflow.items.find((item) => item.claimedBy && !doneStages.has(item.stage)) ??
		workflow.items.find((item) => !doneStages.has(item.stage)) ??
		workflow.items[0] ??
		null;
	const primaryStage = primaryItem
		? resolvedStages.find((stage) => stage.id === primaryItem.stage)
		: null;
	const primaryState = primaryItem
		? itemOperationalState(primaryItem, workflow, activeFlow)
		: null;
	const primaryTone =
		primaryState === "blocked" ? "danger"
			: primaryState === "waiting" ? "warning"
				: primaryState === "done" ? "success"
					: "info";
	const primaryActionLabel =
		primaryState === "blocked" ? "Examinar bloqueio"
			: primaryState === "waiting" ? "Revisar decisão"
				: primaryItem ? "Abrir trabalho em foco"
					: "Criar item";
	const primaryDescription = primaryItem
		? `${primaryItem.description || primaryItem.id} está em ${primaryStage?.name ?? primaryItem.stage}. ${primaryItem.claimedBy ? `${primaryItem.claimedBy} está responsável por este trabalho.` : "Nenhum responsável declarado."}`
		: "Nenhum item foi criado neste fluxo. Crie o primeiro item quando houver trabalho supervisionável.";

	return (
		<div className="app-section-shell min-w-0">
			{/* ─── 1. Mission Control Header ─── */}
			<NavHeader
				title="Trabalho"
				description={`${totalItems} itens · ${attentionItems} atenção`}
				left={<Icon name="grid" size={20} />}
				right={
					<>
						<Badge icon="cpu" variant={activeAgents > 0 ? "agent" : "info"} tone="soft">
							{activeAgents} em andamento
						</Badge>
						<Badge icon="shield" variant={attentionItems > 0 ? (blockedItems > 0 ? "error" : "amber") : "info"} tone="soft">
							{attentionItems} atenção
						</Badge>
						<DropdownMenu>
							{({ open, setOpen }) => (
								<>
									<DropdownMenuTrigger
										className="h-8 px-2 text-caption"
										onClick={() => setOpen(!open)}
									>
										<Icon name="settings" size={12} />
										Administração
									</DropdownMenuTrigger>
									{open ? (
										<DropdownMenuContent align="end" className="min-w-48">
											<DropdownMenuLabel>Operações do fluxo</DropdownMenuLabel>
											<DropdownMenuItem onClick={() => { setShowAddDialog(true); setOpen(false); }}>
												<Icon name="plus" size={12} />
												Novo item
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={() => { setAdminMode("stages"); setOpen(false); }}>
												<Icon name="list-three" size={12} />
												Configurar estágios
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => { setAdminMode("webhooks"); setOpen(false); }}>
												<Icon name="activity" size={12} />
												Configurar webhooks
											</DropdownMenuItem>
										</DropdownMenuContent>
									) : null}
								</>
							)}
						</DropdownMenu>
					</>
				}
			/>

			<div className="flex min-w-0 flex-1 overflow-hidden">
				{stagesEditMode ? (
					<div className="flex-1 overflow-y-auto p-5">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="app-section-muted text-xs font-medium">Arraste os estágios para reordenar. Configure permissões de transição e validação.</p>
							{editingStages.map((stage, idx) => (
								<div key={stage.id} draggable onDragStart={() => handleStageDragStart(idx)} onDragOver={(e) => handleStageDragOver(e, idx)} onDragEnd={handleStageDragEnd}
									className={cn("app-section-card p-3 transition-all", dragStageIdx === idx && "opacity-40")}>
									<div className="flex items-start gap-3">
										<div className="flex-1 flex flex-col gap-2">
											<div className="flex items-center gap-2">
												<Icon name="list-three" size={16} className="app-section-muted cursor-grab" />
												<Input value={stage.name} onChange={(e) => handleUpdateStage(idx, "name", e.target.value)}
													className="app-input-surface flex-1 text-sm font-medium px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
												<span className="app-muted-chip text-xs px-2 py-0.5 rounded-full">{stage.id}</span>
												<Button onClick={() => handleRemoveStage(idx)} className="app-danger-button text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" aria-label="Remover estágio">
													<Icon name="x" size={12} />
												</Button>
											</div>
										</div>
									</div>
								</div>
							))}
							<div className="flex gap-2">
								<Button size="sm" variant="secondary" onClick={handleAddStage}>Adicionar estágio</Button>
								<Button size="sm" variant="secondary" onClick={() => setAdminMode("webhooks")}>Webhooks</Button>
								<Button size="sm" onClick={handleSaveStages}>Salvar</Button>
								<Button size="sm" variant="secondary" onClick={() => { setAdminMode(null); setEditingStages(workflow.stages); }}>Voltar</Button>
							</div>
						</div>
					</div>
				) : webhooksEditMode ? (
					<div className="flex-1 overflow-y-auto p-5">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="app-section-muted text-xs font-medium">Configure webhooks para receber notificações quando itens forem movidos entre estágios.</p>
							{editingWebhooks.map((wh, idx) => (
								<div key={wh.id} className="app-section-card p-3">
									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-2">
											<Input value={wh.label ?? ""} onChange={(e) => handleUpdateWebhook(idx, "label", e.target.value || undefined)} placeholder="Label" className="app-input-surface flex-1 text-sm px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
											<Button onClick={() => handleRemoveWebhook(idx)} className="app-danger-button text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" aria-label="Remover webhook">
												<Icon name="x" size={12} />
											</Button>
										</div>
									</div>
								</div>
							))}
							<div className="flex gap-2">
								<Button size="sm" variant="secondary" onClick={handleAddWebhook}>Adicionar webhook</Button>
								<Button size="sm" variant="secondary" onClick={() => setAdminMode("stages")}>Estágios</Button>
								<Button size="sm" onClick={handleSaveWebhooks}>Salvar</Button>
								<Button size="sm" variant="secondary" onClick={() => { setAdminMode(null); setEditingWebhooks(workflow.webhooks ?? []); }}>Voltar</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="app-section-shell min-w-0 gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4 xl:overflow-hidden">
						<ActionPanel
							className="min-w-0"
							tone={primaryTone}
							icon={<Icon name={primaryState === "blocked" ? "shield" : primaryState === "waiting" ? "clock" : "grid"} size={20} />}
							title={primaryItem ? `Próximo trabalho seguro: ${primaryItem.id}` : "Nenhum trabalho em foco"}
							description={primaryDescription}
							meta={
								<>
									{primaryItem ? <Badge variant="info" tone="soft">{primaryStage?.name ?? primaryItem.stage}</Badge> : null}
									{primaryItem?.claimedBy ? <Tag>{primaryItem.claimedBy}</Tag> : null}
								</>
							}
							action={
								<Button
									size="sm"
									onClick={() => {
										if (primaryItem) setSelectedItemId(primaryItem.id);
										else setShowAddDialog(true);
									}}
								>
									{primaryActionLabel}
								</Button>
							}
							secondaryAction={
								primaryItem ? (
									<Button size="sm" variant="secondary" onClick={() => setShowAddDialog(true)}>
										Novo item
									</Button>
								) : null
							}
						/>

						<div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
							{[
								{ label: "Atenção", value: attentionItems, sub: blockedItems > 0 ? `${blockedItems} bloqueado${blockedItems === 1 ? "" : "s"}` : "decisão humana", color: attentionItems > 0 ? "var(--color-warning)" : "var(--color-text-secondary)", icon: "shield", urgent: attentionItems > 0 },
								{ label: "Em andamento", value: runningItems, sub: `${activeAgents} ator${activeAgents === 1 ? "" : "es"} ativo${activeAgents === 1 ? "" : "s"}`, color: "var(--color-primary)", icon: "cpu", pulse: runningItems > 0 },
								{ label: "Na fila", value: queuedItems, sub: "sem responsável", color: "var(--color-text-secondary)", icon: "circle" },
								{ label: "Progresso", value: `${pctComplete}%`, sub: `${doneItems}/${totalItems} concluídos`, color: "var(--color-primary)", icon: "bar-chart" },
							].map((stat) => (
								<Card key={stat.label} className="app-summary-card hover:shadow-sm" data-urgent={stat.urgent ? "true" : "false"}>
									<CardContent className="grid gap-0.5 p-2.5">
										<div className="flex items-center justify-between">
											<span className="app-section-muted text-caption font-medium uppercase tracking-wider">{stat.label}</span>
											{stat.icon && <Icon name={stat.icon as any} size={10} style={{ color: stat.color }} />}
										</div>
										<div className="flex items-baseline gap-1">
											<span className={cn("text-lg font-bold tabular-nums", stat.pulse && "animate-pulse")} style={{ color: stat.color }}>{stat.value}</span>
											{stat.pulse && <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-pulse" />}
										</div>
										<span className="app-section-muted text-caption">{stat.sub}</span>
									</CardContent>
								</Card>
							))}
						</div>

						{/* ─── 3. Agent Control Center ─── */}
						{Object.keys(agentItems).length > 0 && (
							<div className="min-w-0 shrink-0">
								<div className="flex items-center gap-2 mb-2">
									<span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">Atores em andamento</span>
									<div className="app-section-muted flex items-center gap-1 text-caption">
										<div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
										<span>{activeAgents} ativo{activeAgents !== 1 ? "s" : ""}</span>
									</div>
								</div>
								<div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
									{Object.entries(agentItems).map(([name, items], ai) => {
										const latestItem = items[0];
										const resolvedStage = orderedStages(workflow, activeFlow).find((entry) => entry.id === latestItem.stage);
										const action = resolvedStage ? stageActionLabel(resolvedStage) : "Processando";
										const totalACs = items.reduce((sum, it) => {
											if (it.tasks) return sum + it.tasks.filter((t) => t.done).length;
											return sum;
										}, 0);
										const totalTasks = items.reduce((sum, it) => sum + (it.tasks?.length || 0), 0);
										const pct = totalTasks > 0 ? Math.round((totalACs / totalTasks) * 100) : null;
										const isRunning = !humanGateStages.has(latestItem.stage) && !doneStages.has(latestItem.stage);
										return (
											<div
												key={name}
												className={cn("app-agent-card p-3 min-w-[160px] flex flex-col gap-1.5 shrink-0 transition-all hover:shadow-sm", isRunning && "animate-agent-breathe")}
												data-running={isRunning ? "true" : "false"}
											>
												<div className="flex items-center gap-2">
													<div className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold" style={{ background: `color-mix(in oklch, ${AGENT_COLORS[ai % AGENT_COLORS.length]} 20%, transparent)`, color: AGENT_COLORS[ai % AGENT_COLORS.length] }}>
														{name.charAt(0).toUpperCase()}
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1">
															<span className="text-xs font-semibold truncate">{name}</span>
															{isRunning && <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-pulse" />}
														</div>
														<span className="app-section-muted text-caption">{action}</span>
													</div>
												</div>
												<div className="flex flex-col gap-0.5">
													{pct === null ? (
														<span className="app-section-muted text-caption">
															Sem progresso declarado
														</span>
													) : (
														<div className="flex items-center gap-1">
															<Progress value={pct} max={100} size="xs" className="flex-1" />
															<span className="text-caption tabular-nums font-medium text-[var(--color-text-primary)]">{pct}%</span>
														</div>
													)}
													<span className="app-section-muted text-caption">
														{items.length} {items.length === 1 ? "item" : "itens"}
													</span>
												</div>
												<div className={cn("text-caption font-medium px-1.5 py-0.5 rounded-full self-start", isRunning ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "bg-muted text-muted-foreground")}>
													{isRunning ? "Em andamento" : "Na fila"}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* ─── 4. Pipeline Visual (connected) ─── */}
						<div className="hidden min-w-0 shrink-0 overflow-x-auto pb-1 [scrollbar-width:thin]">
							<div className="flex min-w-max items-center gap-0">
								{pipelineStages.map((stage, idx) => {
									const isCurrent = idx === currentStageIdx;
									const isDone = idx < currentStageIdx;
									const isHumanGate = stage.isHumanGate;
									const hasItems = stage.itemCount > 0;
									const isLast = idx === pipelineStages.length - 1;
									return (
										<div key={stage.id} className="flex items-center gap-0 flex-1">
											<Tooltip content={`${stage.name}: ${stage.itemCount} itens`}>
												<div className={cn(
													"flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-md)] transition-all cursor-default border",
													isCurrent && "border-primary/40 bg-primary/[0.06]",
													isDone && "border-transparent",
													isHumanGate && hasItems && "border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06]",
													!isCurrent && !isDone && !(isHumanGate && hasItems) && "border-transparent",
												)}>
													{isDone ? (
														<Icon name="check" size={10} style={{ color: "var(--color-success)" }} />
													) : isCurrent ? (
														<div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
													) : (
														<div className="w-1.5 h-1.5 rounded-full" style={{ background: hasItems ? "var(--color-text-secondary)" : "var(--color-border)" }} />
													)}
													<div className="flex flex-col">
														<div className="flex items-center gap-1">
															<span className={cn(
																"text-caption font-semibold truncate",
																isDone && "text-[var(--color-success)]",
																isCurrent && "text-[var(--color-primary)]",
																isHumanGate && hasItems && "text-[var(--color-success)]",
															)}>{stage.name}</span>
															{hasItems && (
																<Badge variant={isHumanGate ? "amber" : "info"} className="text-[7px] px-1 py-0 h-3.5">{stage.itemCount}</Badge>
															)}
														</div>
													</div>
												</div>
											</Tooltip>
											{!isLast && (
												<div className="flex-1 h-px mx-1" style={{ background: isDone ? "var(--color-success)" : "var(--color-border)" }} />
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* ─── 5. Filter Group ─── */}
						<div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
							<ButtonGroup ariaLabel="Filtrar trabalho" className="w-max max-w-none flex-nowrap sm:w-auto sm:max-w-full sm:flex-wrap">
								{filterOptions.map(({ key, label }) => (
									<ButtonGroupItem
										key={key}
										selected={activeFilter === key}
										count={filterCounts[key]}
										onClick={() => setActiveFilter(key)}
									>
										{label}
									</ButtonGroupItem>
								))}
							</ButtonGroup>
						</div>

						{/* ─── 6+7. Kanban + Timeline ─── */}
						<div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
							<div className="app-section-card flex min-w-0 flex-1 flex-col overflow-hidden">
								<KanbanBoard
									workflow={workflow}
									activeFlow={activeFlow}
									onSelectItem={setSelectedItemId}
									onDropItem={handleDropItem}
									allowDrop={allowMoveToStage}
									specRefreshKey={specRefreshKey}
									filter={activeFilter}
									onApproveGate={(gateId) => {
										const next = nextStageId(gateId, workflow, activeFlow);
										if (!next) return;
										for (const item of workflow.items.filter((it) => it.stage === gateId)) {
											doMoveItem(item.id, next);
										}
									}}
								/>
							</div>
							<div className="app-section-card hidden w-72 shrink-0 xl:block">
								<ActivityTimeline workflow={workflow} activeFlow={activeFlow} onSelectItem={setSelectedItemId} />
							</div>
						</div>
					</div>
				)}
				{selectedItem && (
					<ItemDetailModal
						item={selectedItem}
						workflow={workflow}
						activeFlow={activeFlow}
						specs={specs}
						onClose={() => setSelectedItemId(null)}
						onItemMoved={onItemMoved}
						onOpenSpec={onOpenSpec}
					/>
				)}
			</div>

			<PromptDialog
				open={showAddDialog}
				onClose={() => setShowAddDialog(false)}
				onSubmit={handleAddItem}
				title="Adicionar Item"
				label="Nome do item"
				placeholder="ex: my-feature"
				submitLabel="Criar"
			/>

			<ConfirmDialog
				open={showDeleteDialog}
				onClose={() => setShowDeleteDialog(false)}
				onConfirm={handleDelete}
				title="Excluir Item"
				message={`Tem certeza que deseja excluir ${selectedItem?.id}?`}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
				variant="danger"
			/>

			<Dialog
				open={validateDialogItem !== null}
				onClose={() => setValidateDialogItem(null)}
				title="Validação necessária"
				actions={
					<>
						<Button
							onClick={() => setValidateDialogItem(null)}
							className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-[var(--radius-sm)] border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer"
						>
							Cancelar
						</Button>
						<Button
							onClick={handleValidateConfirm}
							disabled={!validateDialogItem?.pendingChecks.every(Boolean)}
							className="app-primary-button inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-[var(--radius-sm)] border border-transparent cursor-pointer disabled:opacity-50"
						>
							Mover
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-2">
					<p className="app-section-muted text-xs mb-1">
						Antes de mover, confirme os itens abaixo:
					</p>
					{validateDialogItem?.pendingChecks.map((checked, i) => {
						const stage = workflow.stages.find(
							(s) => s.id === (selectedItem?.stage ?? ""),
						);
						const checks = stage?.validate ?? [];
						return (
							<Checkbox
								key={i}
								checked={checked}
								label={checks[i] ?? `Check ${i + 1}`}
								onChange={(e) => {
									setValidateDialogItem((prev) => {
										if (!prev) return prev;
										const newChecks = [...prev.pendingChecks];
										newChecks[i] = e.target.checked;
										return { ...prev, pendingChecks: newChecks };
									});
								}}
							/>
						);
					})}
				</div>
			</Dialog>
		</div>
	);
}

