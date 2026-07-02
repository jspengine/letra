import { useCallback, useEffect, useState } from "react";
import type { ResolvedSpec, Workflow } from "@letra/types";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import KanbanBoard from "./KanbanBoard";
import ActivityTimeline from "./ActivityTimeline";
import ItemDetailModal from "./ItemDetailModal";
import { cn } from "../../lib/utils";
import {
	Button,
	Checkbox,
	Icon,
	Input,
	ConfirmDialog,
	PromptDialog,
	Dialog,
	Badge,
	Avatar,
	Progress,
	Separator,
	Tabs,
	Tooltip,
	Card,
	CardContent,
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
	onTabChange?: (tab: "specs") => void;
}

function daysSince(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function FlowView({ workflow, activeFlow, specRefreshKey, onItemMoved, onTabChange }: Props) {
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [stagesEditMode, setStagesEditMode] = useState(false);
	const [editingStages, setEditingStages] = useState(workflow.stages);
	const [webhooksEditMode, setWebhooksEditMode] = useState(false);
	const [editingWebhooks, setEditingWebhooks] = useState(workflow.webhooks ?? []);
	const [validateDialogItem, setValidateDialogItem] = useState<{
		itemId: string;
		targetStage: string;
		pendingChecks: boolean[];
	} | null>(null);
	const [dragStageIdx, setDragStageIdx] = useState<number | null>(null);
	const [activeFilter, setActiveFilter] = useState("all");
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

	function handleOpenSpec() {
		if (!selectedItem?.spec || !onTabChange) return;
		onTabChange("specs");
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
				setStagesEditMode(false);
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
				setWebhooksEditMode(false);
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
				<span className="text-xs" title="Transição não permitida">
					🚫
				</span>
			);
		return null;
	};

	const totalItems = workflow.items.length;
	const doneItems = workflow.items.filter((it) => doneStages.has(it.stage)).length;
	const pctComplete = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
	const activeAgents = workflow.items.filter((it) => it.claimedBy && !doneStages.has(it.stage)).length;
	const waitingHuman = workflow.items.filter((it) => humanGateStages.has(it.stage)).length;
	const blockedItems = workflow.items.filter(
		(item) => itemOperationalState(item, workflow, activeFlow) === "blocked",
	).length;
	const avgDays = totalItems > 0
		? Math.round(workflow.items.reduce((sum, it) => sum + daysSince(it.createdAt), 0) / totalItems)
		: 0;
	const uniqueLLMs = new Set(workflow.items.filter((it) => it.claimedBy).map((it) => it.claimedBy)).size;
	const runningItems = workflow.items.filter((it) => it.claimedBy && !humanGateStages.has(it.stage) && !doneStages.has(it.stage)).length;

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

	const AGENT_COLORS = ["var(--primary)", "var(--warning)", "var(--live)", "var(--success)", "var(--error)"];

	const filterCounts = {
		all: totalItems,
		running: runningItems,
		waiting: waitingHuman,
		blocked: blockedItems,
		error: 0,
		done: doneItems,
	};

	return (
		<div className="flex flex-col flex-1 min-h-0" style={{ background: "var(--background)" }}>
			{/* ─── 1. Mission Control Header ─── */}
			<div className="shrink-0 border-b" style={{ borderColor: "var(--border)", background: "color-mix(in oklch, var(--card) 70%, transparent)" }}>
				<div className="flex items-center gap-3 px-5 py-2.5">
					<div className="flex items-center gap-2.5">
						<div className="w-6 h-6 rounded-md bg-[var(--primary)] flex items-center justify-center shadow-sm">
							<span className="text-xs font-bold text-white">L</span>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold">{workflow.name || "Letra"}</span>
								<span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>flow-main</span>
							</div>
							<div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
								<span>main</span>
								<span>·</span>
								<span>{totalItems} itens</span>
								<span>·</span>
								<span>{doneItems} done</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3 ml-auto">
						<div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
							<div className="flex items-center gap-1">
								<div className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
								<span className="tabular-nums font-medium" style={{ color: "var(--live)" }}>{activeAgents}</span>
								<span>agentes</span>
							</div>
							<span className="opacity-30">|</span>
							<span>{uniqueLLMs} LLMs</span>
							<span className="opacity-30">|</span>
							<span>sync: SSE</span>
							<span className="opacity-30">|</span>
							<span>up 12m</span>
						</div>
						<Button size="sm" variant="ghost" onClick={() => { setStagesEditMode(!stagesEditMode); setWebhooksEditMode(false); }} className="text-[10px] h-7 px-2">
							<Icon name="list-three" size={12} /> Stages
						</Button>
						{!stagesEditMode && !webhooksEditMode && (
							<Button size="sm" onClick={() => setShowAddDialog(true)} className="text-[10px] h-7 px-2">
								<Icon name="plus" size={12} /> Item
							</Button>
						)}
					</div>
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
				{stagesEditMode ? (
					<div className="flex-1 overflow-y-auto p-5">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Arraste os stages para reordenar. Configure permissões de transição e validação.</p>
							{editingStages.map((stage, idx) => (
								<div key={stage.id} draggable onDragStart={() => handleStageDragStart(idx)} onDragOver={(e) => handleStageDragOver(e, idx)} onDragEnd={handleStageDragEnd}
									className={cn("rounded-xl border p-3 transition-all", dragStageIdx === idx && "opacity-40")} style={{ borderColor: "var(--border)", background: "var(--card)" }}>
									<div className="flex items-start gap-3">
										<div className="flex-1 flex flex-col gap-2">
											<div className="flex items-center gap-2">
												<Icon name="list-three" size={16} className="cursor-grab" style={{ color: "var(--muted-foreground)" }} />
												<Input value={stage.name} onChange={(e) => handleUpdateStage(idx, "name", e.target.value)}
													className="flex-1 text-sm font-medium px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: "var(--muted)", color: "var(--foreground)" }} />
												<span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{stage.id}</span>
												<Button onClick={() => handleRemoveStage(idx)} className="text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" style={{ color: "var(--error)" }}>✕</Button>
											</div>
										</div>
									</div>
								</div>
							))}
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={handleAddStage}>+ Add Stage</Button>
								<Button size="sm" onClick={handleSaveStages}>Salvar</Button>
								<Button size="sm" variant="outline" onClick={() => { setStagesEditMode(false); setEditingStages(workflow.stages); }}>Cancelar</Button>
							</div>
						</div>
					</div>
				) : webhooksEditMode ? (
					<div className="flex-1 overflow-y-auto p-5">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Configure webhooks para receber notificações quando itens forem movidos entre estágios.</p>
							{editingWebhooks.map((wh, idx) => (
								<div key={wh.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-2">
											<Input value={wh.label ?? ""} onChange={(e) => handleUpdateWebhook(idx, "label", e.target.value || undefined)} placeholder="Label" className="flex-1 text-sm px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: "var(--muted)", color: "var(--foreground)" }} />
											<Button onClick={() => handleRemoveWebhook(idx)} className="text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" style={{ color: "var(--error)" }}>✕</Button>
										</div>
									</div>
								</div>
							))}
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={handleAddWebhook}>+ Add Webhook</Button>
								<Button size="sm" onClick={handleSaveWebhooks}>Salvar</Button>
								<Button size="sm" variant="outline" onClick={() => { setWebhooksEditMode(false); setEditingWebhooks(workflow.webhooks ?? []); }}>Cancelar</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col flex-1 overflow-hidden p-4 gap-4" style={{ background: "var(--background)" }}>
						{/* ─── 2. Executive Summary (6 stat cards) ─── */}
						<div className="grid grid-cols-6 gap-2 shrink-0">
							{[
								{ label: "Progresso", value: `${pctComplete}%`, sub: `${doneItems}/${totalItems}`, color: "var(--primary)", icon: "bar-chart" },
								{ label: "Agentes", value: activeAgents, sub: `${runningItems} executando`, color: "var(--live)", icon: "cpu", pulse: true },
								{ label: "Aguardando", value: waitingHuman, sub: "revisão humana", color: "var(--gate-available)", icon: "clock", urgent: waitingHuman > 0 },
								{ label: "Bloqueados", value: blockedItems, sub: "itens parados", color: "var(--error)", icon: "shield", urgent: blockedItems > 0 },
								{ label: "Idade média", value: avgDays > 0 ? `${avgDays}d` : "—", sub: "desde a criação", color: "var(--muted-foreground)" },
								{ label: "Concluídos", value: doneItems, sub: `${pctComplete}% completo`, color: "var(--success)", icon: "check-circle" },
							].map((stat) => (
								<Card key={stat.label}
									className="rounded-lg transition-all hover:shadow-sm"
									style={{
										borderColor: stat.urgent ? "var(--gate-available)" : "var(--border)",
										background: stat.urgent ? "color-mix(in oklch, var(--gate-available) 6%, var(--card))" : "var(--card)",
									}}
								>
									<CardContent className="grid gap-0.5 p-2.5">
										<div className="flex items-center justify-between">
											<span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{stat.label}</span>
											{stat.icon && <Icon name={stat.icon as any} size={10} style={{ color: stat.color }} />}
										</div>
										<div className="flex items-baseline gap-1">
											<span className={cn("text-lg font-bold tabular-nums", stat.pulse && "animate-pulse")} style={{ color: stat.urgent ? "var(--gate-available)" : stat.color }}>{stat.value}</span>
											{stat.pulse && <span className="w-1 h-1 rounded-full bg-[var(--live)] animate-pulse" />}
										</div>
										<span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{stat.sub}</span>
									</CardContent>
								</Card>
							))}
						</div>

						{/* ─── 3. Agent Control Center ─── */}
						{Object.keys(agentItems).length > 0 && (
							<div className="shrink-0">
								<div className="flex items-center gap-2 mb-2">
									<span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Agent Control Center</span>
									<div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
										<div className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
										<span>{activeAgents} ativo{activeAgents !== 1 ? "s" : ""}</span>
									</div>
								</div>
								<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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
											<div key={name}
												className={cn("rounded-lg border p-3 min-w-[160px] flex flex-col gap-1.5 shrink-0 transition-all hover:shadow-sm", isRunning && "animate-agent-breathe")}
												style={{
													borderColor: isRunning ? "var(--live)" : "var(--border)",
													background: isRunning ? "color-mix(in oklch, var(--card) 80%, var(--live) 5%)" : "var(--card)",
												}}
											>
												<div className="flex items-center gap-2">
													<div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: `color-mix(in oklch, ${AGENT_COLORS[ai % AGENT_COLORS.length]} 20%, transparent)`, color: AGENT_COLORS[ai % AGENT_COLORS.length] }}>
														{name.charAt(0).toUpperCase()}
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1">
															<span className="text-xs font-semibold truncate">{name}</span>
															{isRunning && <span className="w-1 h-1 rounded-full bg-[var(--live)] animate-pulse" />}
														</div>
														<span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{action}</span>
													</div>
												</div>
												<div className="flex flex-col gap-0.5">
													{pct === null ? (
														<span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>
															Sem progresso declarado
														</span>
													) : (
														<div className="flex items-center gap-1">
															<Progress value={pct} max={100} size="xs" className="flex-1" />
															<span className="text-[9px] tabular-nums font-medium" style={{ color: "var(--foreground)" }}>{pct}%</span>
														</div>
													)}
													<span className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>
														{items.length} item{items.length > 1 ? "ns" : ""}
													</span>
												</div>
												<div className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full self-start", isRunning ? "bg-[var(--live)]/10 text-[var(--live)]" : "bg-muted text-muted-foreground")}>
													{isRunning ? "● Running" : "● Queued"}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* ─── 4. Pipeline Visual (connected) ─── */}
						<div className="shrink-0">
							<div className="flex items-center gap-0">
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
													"flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all cursor-default border",
													isCurrent && "border-primary/40 bg-primary/[0.06]",
													isDone && "border-transparent",
													isHumanGate && hasItems && "border-[var(--gate-available)]/40 bg-[var(--gate-available)]/[0.06]",
													!isCurrent && !isDone && !(isHumanGate && hasItems) && "border-transparent",
												)}>
													{isDone ? (
														<Icon name="check" size={10} style={{ color: "var(--success)" }} />
													) : isCurrent ? (
														<div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
													) : (
														<div className="w-1.5 h-1.5 rounded-full" style={{ background: hasItems ? "var(--muted-foreground)" : "var(--border)" }} />
													)}
													<div className="flex flex-col">
														<div className="flex items-center gap-1">
															<span className={cn(
																"text-[9px] font-semibold truncate",
																isDone && "text-[var(--success)]",
																isCurrent && "text-[var(--primary)]",
																isHumanGate && hasItems && "text-[var(--gate-available)]",
															)}>{stage.name}</span>
															{hasItems && (
																<Badge variant={isHumanGate ? "warning" : "secondary"} className="text-[7px] px-1 py-0 h-3.5">{stage.itemCount}</Badge>
															)}
														</div>
													</div>
												</div>
											</Tooltip>
											{!isLast && (
												<div className="flex-1 h-px mx-1" style={{ background: isDone ? "var(--success)" : "var(--border)" }} />
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* ─── 5. Filter Chips ─── */}
						<div className="flex items-center gap-1.5 shrink-0 flex-wrap">
							{(["all", "running", "waiting", "blocked", "error", "done"] as const).map((f) => (
								<Button key={f} type="button" onClick={() => setActiveFilter(f)}
									className={cn(
										"inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full transition-all font-medium",
										activeFilter === f
											? "bg-primary text-primary-foreground shadow-sm"
											: "hover:bg-muted border border-transparent hover:border-border",
									)}
									style={activeFilter !== f ? { color: "var(--muted-foreground)" } : {}}
								>
									{f === "all" ? "Todos" : f === "running" ? "Executando" : f === "waiting" ? "Aguardando" : f === "blocked" ? "Bloqueados" : f === "error" ? "Erro" : "Concluídos"}
									<span className={cn(
										"tabular-nums font-mono",
										activeFilter === f ? "text-primary-foreground/70" : "text-muted-foreground",
									)}>
										{filterCounts[f]}
									</span>
								</Button>
							))}
						</div>

						{/* ─── 6+7. Kanban + Timeline ─── */}
						<div className="flex flex-1 overflow-hidden gap-3">
							<div className="flex-1 self-start rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
								<KanbanBoard
									workflow={workflow}
									activeFlow={activeFlow}
									onSelectItem={setSelectedItemId}
									onDropItem={handleDropItem}
									allowDrop={allowMoveToStage}
									specRefreshKey={specRefreshKey}
									onAddItem={() => setShowAddDialog(true)}
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
							<div className="w-52 shrink-0 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
								<ActivityTimeline workflow={workflow} activeFlow={activeFlow} />
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
						onTabChange={onTabChange}
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
							className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer"
						>
							Cancelar
						</Button>
						<Button
							onClick={handleValidateConfirm}
							disabled={!validateDialogItem?.pendingChecks.every(Boolean)}
							className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent cursor-pointer disabled:opacity-50"
							style={{
								background: "var(--primary)",
								color: "var(--primary-foreground)",
							}}
						>
							Mover
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-2">
					<p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
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
