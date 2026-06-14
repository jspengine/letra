import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedSpec, Workflow } from "@letra/types";
import KanbanView from "../Kanban/KanbanView";
import { Markdown } from "../ui/markdown";
import { Badge, Button, Checkbox, Icon, ConfirmDialog, PromptDialog, Dialog, Input, Alert } from "@letra/ui";

interface Props {
	workflow: Workflow;
	onItemMoved: () => void;
	onTabChange?: (tab: "specs") => void;
}

function daysSince(dateStr: string): number {
	return Math.floor(
		(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
	);
}

function nextStage(itemStage: string, stages: Workflow["stages"]): string | null {
	const idx = stages.findIndex((s) => s.id === itemStage);
	if (idx < 0 || idx >= stages.length - 1) return null;
	return stages[idx + 1].id;
}

export default function FlowView({ workflow, onItemMoved, onTabChange }: Props) {
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [stagesEditMode, setStagesEditMode] = useState(false);
	const [editingStages, setEditingStages] = useState(workflow.stages);
	const [webhooksEditMode, setWebhooksEditMode] = useState(false);
	const [editingWebhooks, setEditingWebhooks] = useState(workflow.webhooks ?? []);
	const [validateDialogItem, setValidateDialogItem] = useState<{ itemId: string; targetStage: string; pendingChecks: boolean[] } | null>(null);
	const [dragStageIdx, setDragStageIdx] = useState<number | null>(null);

	const loadSpecs = useCallback(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
	}, []);

	useEffect(() => { loadSpecs(); }, [loadSpecs]);
	useEffect(() => { setEditingStages(workflow.stages); }, [workflow.stages]);
	useEffect(() => { setEditingWebhooks(workflow.webhooks ?? []); }, [workflow.webhooks]);

	const selectedItem = selectedItemId
		? workflow.items.find((it) => it.id === selectedItemId)
		: null;

	const selectedStage = selectedItem
		? workflow.stages.find((s) => s.id === selectedItem.stage)
		: null;

	const linkedSpec = selectedItem?.spec
		? specs.find((s) => s.id === selectedItem.spec)
		: null;

	const nextStageId = selectedItem ? nextStage(selectedItem.stage, workflow.stages) : null;
	const nextStageName = nextStageId ? workflow.stages.find((s) => s.id === nextStageId)?.name : null;

	function allowMoveToStage(item: Workflow["items"][0], targetStageId: string): boolean {
		const srcStage = workflow.stages.find((s) => s.id === item.stage);
		if (!srcStage || !srcStage.allow || srcStage.allow.length === 0) return true;
		return srcStage.allow.includes(targetStageId);
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
			setValidateDialogItem({ itemId, targetStage, pendingChecks: validateChecks.map(() => false) });
			return;
		}
		doMoveItem(itemId, targetStage);
	}

	function handleMoveNext() {
		if (!selectedItem || !nextStageId) return;
		if (!allowMoveToStage(selectedItem, nextStageId)) return;
		const validateChecks = getValidateChecks(selectedItem);
		if (validateChecks.length > 0) {
			setValidateDialogItem({ itemId: selectedItem.id, targetStage: nextStageId, pendingChecks: validateChecks.map(() => false) });
			return;
		}
		doMoveItem(selectedItem.id, nextStageId);
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
			body: JSON.stringify({ tasks: selectedItem.tasks?.map((t) => t.id === taskId ? { ...t, done } : t) }),
		}).then(() => onItemMoved());
	}

	function handleAddItem(name: string) {
		const firstStage = workflow.stages[0]?.id;
		if (!firstStage) return;
		fetch("/api/items", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
				description: name.trim(),
				stage: firstStage,
			}),
		}).then((r) => r.json()).then((data) => {
			if (data && !data.error) onItemMoved();
		});
	}

	function handleSaveStages() {
		fetch("/api/workflow", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stages: editingStages }),
		}).then((r) => r.json()).then(() => {
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
		}).then((r) => r.json()).then(() => {
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
		}).then((r) => {
			handleUpdateWebhook(index, "lastStatus", r.ok ? "ok" : "error");
			handleUpdateWebhook(index, "lastSentAt", new Date().toISOString());
		}).catch(() => {
			handleUpdateWebhook(index, "lastStatus", "error");
			handleUpdateWebhook(index, "lastSentAt", new Date().toISOString());
		});
	}

	function handleAddStage() {
		const id = `stage-${editingStages.length + 1}`;
		setEditingStages((prev) => [...prev, { id, name: `Stage ${editingStages.length + 1}`, order: prev.length, zone: "doing" as const }]);
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
		if (!allowMoveToStage(item, stageId)) return <span className="text-xs" title="Transição não permitida">🚫</span>;
		return null;
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
				<Icon name="flow" size={20} className="text-primary" />
				<div className="flex-1 min-w-0">
					<h2 className="text-sm font-semibold">Flow</h2>
					<p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
						Pipeline de desenvolvimento — estágios, itens e specs associadas
					</p>
				</div>
				<Button size="sm" variant={stagesEditMode ? "default" : "outline"} onClick={() => { setStagesEditMode(!stagesEditMode); setWebhooksEditMode(false); }}>
					Manage Stages
				</Button>
				<Button size="sm" variant={webhooksEditMode ? "default" : "outline"} onClick={() => { setWebhooksEditMode(!webhooksEditMode); setStagesEditMode(false); }}>
					Webhooks
				</Button>
				{!stagesEditMode && !webhooksEditMode && (
					<Button size="sm" onClick={() => setShowAddDialog(true)}>
						+ Add Item
					</Button>
				)}
			</div>
			<div className="flex-1 flex overflow-hidden">
				{stagesEditMode ? (
					<div className="flex-1 overflow-y-auto p-4">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
								Arraste os stages para reordenar. Configure permissões de transição e validação.
							</p>
							{editingStages.map((stage, idx) => (
								<div
									key={stage.id}
									draggable
									onDragStart={() => handleStageDragStart(idx)}
									onDragOver={(e) => handleStageDragOver(e, idx)}
									onDragEnd={handleStageDragEnd}
									className={cn(
										"rounded-xl border p-3 transition-all",
										dragStageIdx === idx && "opacity-40",
									)}
									style={{ borderColor: "var(--border)", background: "var(--card)" }}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1 flex flex-col gap-2">
											<div className="flex items-center gap-2">
												<Icon name="list-three" size={16} className="cursor-grab" style={{ color: "var(--muted-foreground)" }} />
												<input
													value={stage.name}
													onChange={(e) => handleUpdateStage(idx, "name", e.target.value)}
													className="flex-1 text-sm font-medium px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
													style={{ background: "var(--muted)", color: "var(--foreground)" }}
												/>
												<span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
													{stage.id}
												</span>
												<button
													onClick={() => handleRemoveStage(idx)}
													className="text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
													style={{ color: "var(--error)" }}
													aria-label={`Remover ${stage.name}`}
												>
													✕
												</button>
											</div>
											<div className="flex items-center gap-3 text-xs flex-wrap">
												<label className="flex items-center gap-1.5">
													<span style={{ color: "var(--muted-foreground)" }}>Zona:</span>
													<select
														value={stage.zone ?? "doing"}
														onChange={(e) => handleUpdateStage(idx, "zone", e.target.value)}
														className="px-2 py-1 rounded border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
														style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
													>
														<option value="todo">Todo</option>
														<option value="doing">Doing</option>
														<option value="done">Done</option>
													</select>
												</label>
												<label className="flex items-center gap-1.5">
													<span style={{ color: "var(--muted-foreground)" }}>Cor:</span>
													<input
														type="color"
														value={stage.color ?? "#6b7280"}
														onChange={(e) => handleUpdateStage(idx, "color", e.target.value === "#6b7280" ? undefined : e.target.value)}
														className="w-7 h-7 p-0.5 rounded border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
														style={{ borderColor: "var(--border)", background: "var(--background)" }}
													/>
												</label>
												<label className="flex items-center gap-1.5">
													<span style={{ color: "var(--muted-foreground)" }}>Permite mover para:</span>
													<select
														multiple
														value={stage.allow ?? []}
														onChange={(e) => {
															const opts = Array.from(e.target.selectedOptions, (o) => o.value);
															handleUpdateStage(idx, "allow", opts.length > 0 ? opts : undefined);
														}}
														className="px-2 py-1 rounded border text-xs min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/30"
														style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
													>
														{editingStages.filter((s) => s.id !== stage.id).map((s) => (
															<option key={s.id} value={s.id}>{s.name}</option>
														))}
													</select>
												</label>
											</div>
											<div className="flex flex-col gap-1">
												<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Validação ao sair:</span>
												{(stage.validate ?? []).map((v, vi) => (
													<div key={vi} className="flex items-center gap-1">
														<input
															value={v}
															onChange={(e) => {
																const newValidate = [...(editingStages[idx].validate ?? [])];
																newValidate[vi] = e.target.value;
																handleUpdateStage(idx, "validate", newValidate);
															}}
															className="flex-1 text-xs px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
															style={{ background: "var(--muted)", color: "var(--foreground)" }}
															placeholder="Ex: Código revisado"
														/>
														<button
															onClick={() => {
																const newValidate = editingStages[idx].validate?.filter((_, i) => i !== vi);
																handleUpdateStage(idx, "validate", newValidate && newValidate.length > 0 ? newValidate : undefined);
															}}
															className="text-xs px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
															style={{ color: "var(--error)" }}
														>
															✕
														</button>
													</div>
												))}
												<button
													onClick={() => {
														const newValidate = [...(editingStages[idx].validate ?? []), ""];
														handleUpdateStage(idx, "validate", newValidate);
													}}
													className="text-xs self-start px-2 py-1 rounded hover:bg-muted/50 transition-colors"
													style={{ color: "var(--muted-foreground)" }}
												>
													+ Add check
												</button>
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
					<div className="flex-1 overflow-y-auto p-4">
						<div className="flex flex-col gap-3 max-w-2xl">
							<p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
								Configure webhooks para receber notificações quando itens forem movidos entre estágios.
							</p>
							{editingWebhooks.map((wh, idx) => (
								<div key={wh.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-2">
											<input
												value={wh.label ?? ""}
												onChange={(e) => handleUpdateWebhook(idx, "label", e.target.value || undefined)}
												placeholder="Label (ex: Slack #geral)"
												className="flex-1 text-sm px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
												style={{ background: "var(--muted)", color: "var(--foreground)" }}
											/>
											{wh.lastStatus && (
												<span className="text-xs" style={{ color: wh.lastStatus === "ok" ? "var(--success)" : "var(--error)" }}>
													{wh.lastStatus === "ok" ? "✅" : "❌"}
												</span>
											)}
											{wh.lastSentAt && (
												<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
													{new Date(wh.lastSentAt).toLocaleTimeString()}
												</span>
											)}
											<button
												onClick={() => handleRemoveWebhook(idx)}
												className="text-xs px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
												style={{ color: "var(--error)" }}
												aria-label="Remover webhook"
											>
												✕
											</button>
										</div>
										<div className="flex items-center gap-2 text-xs">
											<input
												value={wh.url}
												onChange={(e) => handleUpdateWebhook(idx, "url", e.target.value)}
												placeholder="https://hooks.slack.com/services/..."
												className="flex-1 px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-primary/30"
												style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
											/>
											<Button size="sm" variant="outline" onClick={() => handleTestWebhook(idx)}>
												Test
											</Button>
										</div>
										<div className="flex items-center gap-2 text-xs">
											<span style={{ color: "var(--muted-foreground)" }}>Eventos:</span>
											<label className="flex items-center gap-1">
												<input
													type="checkbox"
													checked={wh.events.includes("item.moved")}
													onChange={(e) => {
														const evts = e.target.checked
															? [...new Set([...wh.events, "item.moved"])]
															: wh.events.filter((ev) => ev !== "item.moved");
														handleUpdateWebhook(idx, "events", evts);
													}}
												/>
												item.moved
											</label>
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
					<div className="flex-1 overflow-auto">
						<KanbanView
							workflow={workflow}
							onSelectItem={setSelectedItemId}
							onItemMoved={onItemMoved}
							onDropItem={handleDropItem}
							allowMoveToStage={allowMoveToStage}
						/>
					</div>
				)}
				{!stagesEditMode && !webhooksEditMode && selectedItem && (
					<div
						className="w-96 border-l overflow-y-auto flex flex-col shrink-0 animate-slide-in-right"
						style={{ borderColor: "var(--border)", background: "var(--card)" }}
					>
						<div className="flex items-start gap-2.5 px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
							<Icon name="flow" size={20} className="text-primary mt-0.5" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<h3 className="font-semibold text-sm">{selectedItem.id}</h3>
									{selectedStage && (
										<Badge variant="secondary">{selectedStage.name}</Badge>
									)}
								</div>
								<p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
									{selectedItem.description}
								</p>
							</div>
							<button
								onClick={() => setSelectedItemId(null)}
								className="text-sm px-2 py-1 rounded hover:bg-muted/50 transition-colors shrink-0"
								style={{ color: "var(--muted-foreground)" }}
								aria-label="Close detail"
							>
								✕
							</button>
						</div>

						<div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--border)" }}>
							{nextStageId && (
								<Button size="sm" onClick={handleMoveNext}>
									Mover para {nextStageName}
								</Button>
							)}
							{selectedItem.spec && (
								<Button size="sm" variant="outline" onClick={handleOpenSpec}>
									Abrir Spec
								</Button>
							)}
							<Button size="sm" variant="outline" onClick={() => setShowDeleteDialog(true)} style={{ color: "var(--error)" }}>
								Excluir
							</Button>
						</div>

						<div className="flex-1 overflow-y-auto p-4">
							<div className="flex flex-col gap-4">
								{selectedItem.tasks && selectedItem.tasks.length > 0 && (
									<div className="flex flex-col gap-1">
										<span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
											Tasks ({selectedItem.tasks.filter((t) => t.done).length}/{selectedItem.tasks.length})
										</span>
										{selectedItem.tasks.map((task) => (
											<Checkbox
												key={task.id}
												checked={task.done}
												label={task.description}
												onChange={(e) => handleTaskToggle(task.id, e.target.checked)}
												style={{ textDecoration: task.done ? "line-through" : undefined }}
											/>
										))}
									</div>
								)}

								<div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
									<span>Criado há {daysSince(selectedItem.createdAt)} dias</span>
									{selectedItem.source && (
										<>
											<span>·</span>
											<span>Fonte: {selectedItem.source}</span>
										</>
									)}
								</div>

								{linkedSpec && (
									<div className="flex flex-col gap-2">
										<div className="flex items-center gap-2">
											<span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
												Spec vinculada: {linkedSpec.id}
											</span>
										</div>
										<div
											className="rounded-lg p-3 text-sm max-h-60 overflow-y-auto"
											style={{ background: "var(--muted)" }}
										>
											<Markdown content={linkedSpec.content} />
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
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
						<button
							onClick={() => setValidateDialogItem(null)}
							className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer"
						>
							Cancelar
						</button>
						<button
							onClick={handleValidateConfirm}
							disabled={!validateDialogItem?.pendingChecks.every(Boolean)}
							className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent cursor-pointer disabled:opacity-50"
							style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
						>
							Mover
						</button>
					</>
				}
			>
				<div className="flex flex-col gap-2">
					<p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
						Antes de mover, confirme os itens abaixo:
					</p>
					{validateDialogItem?.pendingChecks.map((checked, i) => {
						const stage = workflow.stages.find((s) => s.id === (selectedItem?.stage ?? ""));
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

function cn(...classes: (string | boolean | null | undefined)[]): string {
	return classes.filter(Boolean).join(" ");
}
