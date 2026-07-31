import { useState, useEffect, useCallback } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
	Tabs,
	Button,
	Input,
	Textarea,
	Icon,
	Label,
	ConfirmDialog,
	useToast,
} from "@letra/ui";
import type { WorkspaceData } from "../WorkspacesView";

interface WorkflowLocation {
	id: string;
	path: string;
	label: string;
}

interface TemplateOption {
	id: string;
	name: string;
	description?: string;
	stages: Array<{ id: string; name: string }>;
}

interface DirEntry {
	name: string;
	path: string;
}

interface AdapterInfo {
	id: string;
	displayName: string;
	capabilities: {
		instructions: boolean;
		skills: boolean;
		mcp: boolean;
		hooks: boolean;
	};
	detectionPaths: string[];
	active: boolean;
	detected: boolean;
}

interface Props {
	workspace: WorkspaceData;
	onWorkspaceUpdated: (updated: WorkspaceData) => void;
	onWorkspaceDeleted: () => void;
	onRefreshWorkflow: () => void;
}

export default function WorkspaceSettings({
	workspace,
	onWorkspaceUpdated,
	onWorkspaceDeleted,
	onRefreshWorkflow,
}: Props) {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("general");
	const [name, setName] = useState(workspace.name);
	const [description, setDescription] = useState(workspace.description || "");
	const [saving, setSaving] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleteStep, setDeleteStep] = useState<"confirm" | "type-name">("confirm");
	const [deleteInput, setDeleteInput] = useState("");

	// Locations state
	const [locations, setLocations] = useState<WorkflowLocation[]>([]);
	const [loadingLocations, setLoadingLocations] = useState(false);
	const [addingLocation, setAddingLocation] = useState(false);
	const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
	const [deleteLocationPath, setDeleteLocationPath] = useState("");

	// Directory browser state
	const [dirBrowserOpen, setDirBrowserOpen] = useState(false);
	const [dirPath, setDirPath] = useState("");
	const [dirEntries, setDirEntries] = useState<DirEntry[]>([]);
	const [dirLoading, setDirLoading] = useState(false);
	const [dirError, setDirError] = useState("");
	const [selectedDir, setSelectedDir] = useState<DirEntry | null>(null);

	// Flow/template state
	const [templates, setTemplates] = useState<TemplateOption[]>([]);
	const [loadingTemplates, setLoadingTemplates] = useState(false);
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
	const [currentTemplate, setCurrentTemplate] = useState<string>("");
	const [currentStages, setCurrentStages] = useState<Array<{ id: string; name: string }>>([]);
	const [switchingTemplate, setSwitchingTemplate] = useState(false);

	// Adapters state
	const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
	const [loadingAdapters, setLoadingAdapters] = useState(false);
	const [savingAdapters, setSavingAdapters] = useState(false);

	// Undo state
	const undoTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);
	const pendingUndoRef = useState<{ undo: () => void; label: string } | null>(null);

	function showUndoToast(label: string, undoFn: () => void) {
		if (undoTimerRef[0]) clearTimeout(undoTimerRef[0]);
		pendingUndoRef[0] = { undo: undoFn, label };
		const timer = setTimeout(() => {
			pendingUndoRef[0] = null;
		}, 30000);
		undoTimerRef[0] = timer;
		toast(`${label} — Desfazer disponível por 30s`, "success");
	}

	function handleUndo() {
		if (pendingUndoRef[0]) {
			pendingUndoRef[0].undo();
			pendingUndoRef[0] = null;
			if (undoTimerRef[0]) clearTimeout(undoTimerRef[0]);
			toast("Alteração desfeita", "success");
		}
	}

	useEffect(() => {
		setName(workspace.name);
		setDescription(workspace.description || "");
		setActiveTab("general");
		setDeleteStep("confirm");
		setDeleteInput("");
		loadLocations();
		loadTemplates();
		loadCurrentWorkflow();
		loadAdapters();
	}, [workspace.name, workspace.description]);

	const loadTemplates = useCallback(async () => {
		setLoadingTemplates(true);
		try {
			const res = await fetch("/api/harness/templates");
			const data = await res.json();
			setTemplates(Array.isArray(data) ? data : []);
		} catch {
			setTemplates([]);
		} finally {
			setLoadingTemplates(false);
		}
	}, []);

	const loadCurrentWorkflow = useCallback(async () => {
		try {
			const res = await fetch("/api/workflow");
			const data = await res.json();
			setCurrentTemplate(data.template || "");
			setCurrentStages(data.stages?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) || []);
		} catch {
			// ignore
		}
	}, []);

	const loadAdapters = useCallback(async () => {
		setLoadingAdapters(true);
		try {
			const res = await fetch("/api/workflow/adapters");
			const data = await res.json();
			setAdapters(Array.isArray(data) ? data : []);
		} catch {
			setAdapters([]);
		} finally {
			setLoadingAdapters(false);
		}
	}, []);

	const loadLocations = useCallback(async () => {
		setLoadingLocations(true);
		try {
			const res = await fetch("/api/workflow");
			const data = await res.json();
			setLocations(data.locations || []);
		} catch {
			setLocations([]);
		} finally {
			setLoadingLocations(false);
		}
	}, []);

	const hasChanges = name !== workspace.name || description !== (workspace.description || "");
	const nameValid = name.trim().length >= 2;

	async function handleSave() {
		if (!nameValid || saving) return;
		const prevName = workspace.name;
		const prevDescription = workspace.description || "";
		setSaving(true);
		try {
			const res = await fetch("/api/workflow", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), description: description.trim() }),
			});
			if (!res.ok) throw new Error("Failed to save");
			const data = await res.json();
			onWorkspaceUpdated({
				...workspace,
				name: data.name || name.trim(),
				description: data.description ?? description.trim(),
			});
			showUndoToast("Configurações salvas", () => {
				setName(prevName);
				setDescription(prevDescription);
				fetch("/api/workflow", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: prevName, description: prevDescription }),
				});
				onWorkspaceUpdated({
					...workspace,
					name: prevName,
					description: prevDescription,
				});
			});
		} catch {
			toast("Erro ao salvar configurações", "error");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		if (deleteInput !== workspace.name) return;
		try {
			const res = await fetch(`/api/workspaces/${workspace.id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			toast("Workspace excluído", "success");
			setShowDeleteConfirm(false);
			onWorkspaceDeleted();
		} catch {
			toast("Erro ao excluir workspace", "error");
		}
	}

	// ── Location operations ──

	async function handleAddLocation() {
		if (!selectedDir) return;
		const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const label = selectedDir.name;
		const prevLocations = [...locations];
		try {
			const res = await fetch("/api/workflow/locations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, path: selectedDir.path, label }),
			});
			if (!res.ok) throw new Error("Failed to add location");
			const loc = await res.json();
			setLocations((prev) => [...prev, loc]);
			setDirBrowserOpen(false);
			setSelectedDir(null);
			setDirPath("");
			setDirEntries([]);
			showUndoToast("Local adicionado", () => {
				setLocations(prevLocations);
				fetch("/api/workflow/locations/" + id, { method: "DELETE" });
			});
		} catch {
			toast("Erro ao adicionar local", "error");
		}
	}

	async function handleSaveLabel(locId: string) {
		if (!editLabel.trim()) return;
		try {
			const res = await fetch(`/api/workflow/locations/${locId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label: editLabel.trim() }),
			});
			if (!res.ok) throw new Error("Failed to update");
			const updated = await res.json();
			setLocations((prev) => prev.map((l) => (l.id === locId ? updated : l)));
			setEditingLocationId(null);
			toast("Label atualizado", "success");
		} catch {
			toast("Erro ao atualizar label", "error");
		}
	}

	async function handleDeleteLocation() {
		if (!deleteLocationId) return;
		const removedLocation = locations.find((l) => l.id === deleteLocationId);
		const prevLocations = [...locations];
		try {
			const res = await fetch(`/api/workflow/locations/${deleteLocationId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			setLocations((prev) => prev.filter((l) => l.id !== deleteLocationId));
			setDeleteLocationId(null);
			setDeleteLocationPath("");
			if (removedLocation) {
				showUndoToast("Local removido", () => {
					setLocations(prevLocations);
					fetch("/api/workflow/locations", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(removedLocation),
					});
				});
			}
		} catch {
			toast("Erro ao remover local", "error");
		}
	}

	// ── Adapter toggle ──

	async function handleToggleAdapter(adapterId: string) {
		const prevAdapters = [...adapters];
		const adapterName = adapters.find((a) => a.id === adapterId)?.displayName || adapterId;
		const nextAdapters = adapters.map((a) =>
			a.id === adapterId ? { ...a, active: !a.active } : a,
		);
		const nextTools = nextAdapters.filter((a) => a.active).map((a) => a.id);
		setAdapters(nextAdapters);
		setSavingAdapters(true);
		try {
			const res = await fetch("/api/workflow/adapters", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tools: nextTools }),
			});
			if (!res.ok) throw new Error("Failed to update adapters");
			onRefreshWorkflow();
			const wasActive = prevAdapters.find((a) => a.id === adapterId)?.active;
			showUndoToast(`${adapterName} ${wasActive ? "desativado" : "ativado"}`, () => {
				setAdapters(prevAdapters);
				fetch("/api/workflow/adapters", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ tools: prevAdapters.filter((a) => a.active).map((a) => a.id) }),
				});
				onRefreshWorkflow();
			});
		} catch {
			setAdapters(adapters);
			toast("Erro ao atualizar adapters", "error");
		} finally {
			setSavingAdapters(false);
		}
	}

	// ── Template switch ──

	async function handleSwitchTemplate() {
		if (!selectedTemplate || switchingTemplate) return;
		const prevTemplate = currentTemplate;
		const prevStages = [...currentStages];
		setSwitchingTemplate(true);
		try {
			const res = await fetch("/api/workflow/template", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ template: selectedTemplate }),
			});
			if (!res.ok) throw new Error("Failed to switch template");
			const data = await res.json();
			setCurrentTemplate(data.template || selectedTemplate);
			setCurrentStages(data.stages?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) || []);
			setSelectedTemplate(null);
			onRefreshWorkflow();
			showUndoToast("Template atualizado", () => {
				setCurrentTemplate(prevTemplate);
				setCurrentStages(prevStages);
				fetch("/api/workflow/template", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ template: prevTemplate }),
				});
				onRefreshWorkflow();
			});
		} catch {
			toast("Erro ao atualizar template", "error");
		} finally {
			setSwitchingTemplate(false);
		}
	}

	// ── Directory browser ──

	async function browseDir(path?: string) {
		setDirLoading(true);
		setDirError("");
		try {
			const url = path ? `/api/fs/dirs?path=${encodeURIComponent(path)}` : "/api/fs/dirs";
			const res = await fetch(url);
			const data = await res.json();
			setDirPath(data.path || "");
			setDirEntries(data.dirs || []);
			if (data.error) setDirError(data.error);
		} catch {
			setDirError("Erro ao listar diretórios");
		} finally {
			setDirLoading(false);
		}
	}

	function openDirBrowser() {
		setDirBrowserOpen(true);
		setSelectedDir(null);
		browseDir();
	}

	return (
		<div className="flex h-full flex-col">
			{/* Page header */}
			<div className="border-b px-6 py-4" style={{ borderColor: "var(--color-border)" }}>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold">Configurações do Workspace</h1>
						<p className="text-caption mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
							{workspace.name}
						</p>
					</div>
					{activeTab === "general" && (
						<Button
							onClick={handleSave}
							disabled={!hasChanges || !nameValid || saving}
							loading={saving}
						>
							Salvar
						</Button>
					)}
				</div>
			</div>

			{/* Tabs + content */}
			<div className="flex-1 overflow-y-auto p-6">
				<Tabs
					tabs={[
						{ id: "general", label: "Geral", icon: <Icon name="settings" size={14} /> },
						{ id: "locations", label: "Locais", icon: <Icon name="folder" size={14} /> },
						{ id: "flow", label: "Fluxo", icon: <Icon name="flow" size={14} /> },
						{ id: "adapters", label: "Adapters", icon: <Icon name="cpu" size={14} /> },
						{ id: "advanced", label: "Avançado", icon: <Icon name="shield" size={14} /> },
					]}
					activeTab={activeTab}
					onChange={setActiveTab}
					ariaLabel="Configurações do workspace"
				>
					{(activeId) => (
						<>
							{activeId === "general" && (
								<div className="space-y-6 mt-4">
									<div className="space-y-4">
										<Label className="flex flex-col items-start gap-[var(--space-2)]">
											<span className="text-caption font-medium" style={{ color: "var(--color-text-secondary)" }}>
												Nome
											</span>
											<Input
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder="Nome do workspace"
												autoFocus
											/>
											{!nameValid && name.length > 0 && (
												<span className="text-caption" style={{ color: "var(--color-error)" }}>
													Mínimo 2 caracteres
												</span>
											)}
										</Label>

										<Label className="flex flex-col items-start gap-[var(--space-2)]">
											<span className="text-caption font-medium" style={{ color: "var(--color-text-secondary)" }}>
												Descrição
											</span>
											<Textarea
												value={description}
												onChange={(e) => setDescription(e.target.value)}
												placeholder="Descreva o propósito deste workspace"
												rows={3}
											/>
										</Label>
									</div>

									<div className="pt-2">
										<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Criado em {new Date(workspace.createdAt).toLocaleDateString("pt-BR")}
										</p>
										{workspace.root && (
											<p className="text-caption mt-1 font-mono" style={{ color: "var(--color-text-secondary)" }}>
												{workspace.root}
											</p>
										)}
									</div>
								</div>
							)}

							{activeId === "locations" && (
								<div className="mt-4 space-y-4">
									<div className="flex items-center justify-between">
										<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Gerencie os diretórios onde esta solução faz alterações.
										</p>
										<Button size="sm" onClick={openDirBrowser}>
											<Icon name="plus" size={14} />
											Adicionar Local
										</Button>
									</div>

									{loadingLocations ? (
										<div className="flex items-center justify-center py-8">
											<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>Carregando...</span>
										</div>
									) : locations.length === 0 ? (
										<div className="rounded-[var(--radius-md)] border border-dashed p-6 text-center" style={{ borderColor: "var(--color-border)" }}>
											<Icon name="folder" size={24} className="mx-auto mb-2" style={{ color: "var(--color-text-secondary)" }} />
											<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
												Nenhum local configurado
											</p>
											<Button size="sm" className="mt-3" onClick={openDirBrowser}>
												Adicionar primeiro local
											</Button>
										</div>
									) : (
										<div className="space-y-2">
											{locations.map((loc) => (
												<div
													key={loc.id}
													className="flex items-center gap-3 rounded-[var(--radius-md)] border p-3"
													style={{ borderColor: "var(--color-border)" }}
												>
													<Icon name="folder" size={16} style={{ color: "var(--color-text-secondary)" }} />
													<div className="flex-1 min-w-0">
														{editingLocationId === loc.id ? (
															<div className="flex items-center gap-2">
																<Input
																	value={editLabel}
																	onChange={(e) => setEditLabel(e.target.value)}
																	className="h-8"
																	autoFocus
																	onKeyDown={(e) => {
																		if (e.key === "Enter") handleSaveLabel(loc.id);
																		if (e.key === "Escape") setEditingLocationId(null);
																	}}
																/>
																<Button size="sm" variant="ghost" onClick={() => handleSaveLabel(loc.id)}>
																	<Icon name="check" size={14} />
																</Button>
																<Button size="sm" variant="ghost" onClick={() => setEditingLocationId(null)}>
																	<Icon name="x" size={14} />
																</Button>
															</div>
														) : (
															<>
																<p className="text-sm font-medium truncate">{loc.label}</p>
																<p className="text-caption font-mono truncate" style={{ color: "var(--color-text-secondary)" }}>
																	{loc.path}
																</p>
															</>
														)}
													</div>
													{editingLocationId !== loc.id && (
														<div className="flex items-center gap-1">
															<Button
																size="sm"
																variant="ghost"
																onClick={() => {
																	setEditingLocationId(loc.id);
																	setEditLabel(loc.label);
																}}
															>
																<Icon name="edit" size={14} />
															</Button>
															<Button
																size="sm"
																variant="ghost"
																onClick={() => {
																	setDeleteLocationId(loc.id);
																	setDeleteLocationPath(loc.path);
																}}
															>
																<Icon name="trash" size={14} />
															</Button>
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{activeId === "flow" && (
								<div className="mt-4 space-y-4">
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
										Altere o template do fluxo de trabalho. Itens em estágios removidos vão para o backlog.
									</p>

									{currentTemplate && (
										<div className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: "var(--color-border)" }}>
											<p className="text-caption font-medium">Template atual: {currentTemplate}</p>
											<div className="mt-2 flex flex-wrap gap-1">
												{currentStages.map((s) => (
													<span
														key={s.id}
														className="rounded-full px-2 py-0.5 text-caption"
														style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
													>
														{s.name}
													</span>
												))}
											</div>
										</div>
									)}

									{loadingTemplates ? (
										<div className="flex items-center justify-center py-4">
											<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>Carregando templates...</span>
										</div>
									) : templates.length === 0 ? (
										<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Nenhum template disponível
										</p>
									) : (
										<div className="space-y-2">
											{templates.map((tpl) => {
												const isCurrent = tpl.id === currentTemplate;
												const isSelected = tpl.id === selectedTemplate;
												const addedStages = tpl.stages.filter((s) => !currentStages.some((cs) => cs.id === s.id));
												const removedStages = currentStages.filter((cs) => !tpl.stages.some((s) => s.id === cs.id));

												return (
													<button
														key={tpl.id}
														type="button"
														className={`flex w-full flex-col gap-2 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
															isSelected
																? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
																: "hover:bg-[var(--color-surface-secondary)]"
														}`}
														style={{ borderColor: isSelected ? undefined : "var(--color-border)" }}
														onClick={() => setSelectedTemplate(isCurrent ? null : tpl.id)}
													>
														<div className="flex items-center justify-between">
															<span className="text-sm font-medium">
																{tpl.name}
																{isCurrent && (
																	<span className="ml-2 text-caption" style={{ color: "var(--color-text-secondary)" }}>
																		(atual)
																	</span>
																)}
															</span>
															{isCurrent && <Icon name="check" size={14} style={{ color: "var(--color-primary)" }} />}
														</div>
														{tpl.description && (
															<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
																{tpl.description}
															</p>
														)}
														<div className="flex flex-wrap gap-1">
															{tpl.stages.map((s) => {
																const isInCurrent = currentStages.some((cs) => cs.id === s.id);
																const isAdded = addedStages.some((a) => a.id === s.id);
																return (
																	<span
																		key={s.id}
																		className="rounded-full px-2 py-0.5 text-caption"
																		style={{
																			background: isAdded
																				? "var(--color-success-subtle)"
																				: isInCurrent
																				? "var(--color-surface-secondary)"
																				: "var(--color-surface-secondary)",
																			color: isAdded
																				? "var(--color-success)"
																				: "var(--color-text-secondary)",
																		}}
																	>
																		{s.name}
																	</span>
																);
															})}
														</div>
														{!isCurrent && (addedStages.length > 0 || removedStages.length > 0) && (
															<div className="text-caption space-y-1" style={{ color: "var(--color-text-secondary)" }}>
																{addedStages.length > 0 && (
																	<p style={{ color: "var(--color-success)" }}>
																		+ {addedStages.map((s) => s.name).join(", ")}
																	</p>
																)}
																{removedStages.length > 0 && (
																	<p style={{ color: "var(--color-error)" }}>
																		- {removedStages.map((s) => s.name).join(", ")}
																	</p>
																)}
															</div>
														)}
													</button>
												);
											})}
										</div>
									)}

									{selectedTemplate && selectedTemplate !== currentTemplate && (
										<Button onClick={handleSwitchTemplate} disabled={switchingTemplate} loading={switchingTemplate}>
											Aplicar template
										</Button>
									)}
								</div>
							)}

							{activeId === "adapters" && (
								<div className="mt-4 space-y-4">
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
										Selecione quais adapters estão ativos. Adapters são regenerados automaticamente.
									</p>

									{loadingAdapters ? (
										<div className="flex items-center justify-center py-4">
											<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>Carregando adapters...</span>
										</div>
									) : adapters.length === 0 ? (
										<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Nenhum adapter disponível
										</p>
									) : (
										<div className="space-y-2">
											{adapters.map((adapter) => {
												const caps = [];
												if (adapter.capabilities.instructions) caps.push("Instructions");
												if (adapter.capabilities.skills) caps.push("Skills");
												if (adapter.capabilities.mcp) caps.push("MCP");
												if (adapter.capabilities.hooks) caps.push("Hooks");

												return (
													<button
														key={adapter.id}
														type="button"
														className={`flex w-full items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
															adapter.active
																? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
																: "hover:bg-[var(--color-surface-secondary)]"
														}`}
														style={{ borderColor: adapter.active ? undefined : "var(--color-border)" }}
														onClick={() => handleToggleAdapter(adapter.id)}
														disabled={savingAdapters}
													>
														<div className="mt-0.5">
															<div
																className={`flex h-4 w-4 items-center justify-center rounded border ${
																	adapter.active
																		? "border-[var(--color-primary)] bg-[var(--color-primary)]"
																		: "border-[var(--color-border)]"
																}`}
															>
																{adapter.active && <Icon name="check" size={10} style={{ color: "var(--color-text-on-primary)" }} />}
															</div>
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium">{adapter.displayName}</span>
																{adapter.detected && (
																	<span
																		className="rounded-full px-2 py-0.5 text-caption"
																		style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
																	>
																		Detectado
																	</span>
																)}
															</div>
															{caps.length > 0 && (
																<div className="mt-1 flex flex-wrap gap-1">
																	{caps.map((cap) => (
																		<span
																			key={cap}
																			className="rounded-full px-2 py-0.5 text-caption"
																			style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
																		>
																			{cap}
																		</span>
																	))}
																</div>
															)}
															{adapter.detected && (
																<p className="text-caption mt-1" style={{ color: "var(--color-text-secondary)" }}>
																	Arquivo(s): {adapter.detectionPaths.join(", ")}
																</p>
															)}
														</div>
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}

							{activeId === "advanced" && (
								<div className="mt-4 space-y-4">
									<div className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-error)" }}>
										<h4 className="text-sm font-semibold" style={{ color: "var(--color-error)" }}>
											Zona de perigo
										</h4>
										<p className="text-caption mt-1" style={{ color: "var(--color-text-secondary)" }}>
											Excluir este workspace remove o registro mas preserva os arquivos no disco.
										</p>
										<Button
											variant="danger"
											size="sm"
											className="mt-3"
											onClick={() => setShowDeleteConfirm(true)}
										>
											Excluir Workspace
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</Tabs>
			</div>

			{/* Delete workspace dialogs */}
			{deleteStep === "confirm" && (
				<ConfirmDialog
					open={showDeleteConfirm}
					onClose={() => setShowDeleteConfirm(false)}
					onConfirm={() => setDeleteStep("type-name")}
					title="Excluir workspace?"
					message={`Tem certeza que deseja excluir "${workspace.name}"? Esta ação é irreversível.`}
					confirmLabel="Continuar"
					variant="danger"
				/>
			)}

			{deleteStep === "type-name" && (
				<ConfirmDialog
					open={showDeleteConfirm}
					onClose={() => setShowDeleteConfirm(false)}
					onConfirm={handleDelete}
					title={`Digite "${workspace.name}" para confirmar`}
					message="Todos os dados serão preservados no disco, mas o registro será removido."
					confirmLabel="Excluir permanentemente"
					variant="danger"
				/>
			)}

			{/* Delete location dialog */}
			{deleteLocationId && (
				<ConfirmDialog
					open={!!deleteLocationId}
					onClose={() => {
						setDeleteLocationId(null);
						setDeleteLocationPath("");
					}}
					onConfirm={handleDeleteLocation}
					title="Remover local?"
					message={`Remover ${deleteLocationPath}?`}
					confirmLabel="Confirmar remoção"
					variant="danger"
				/>
			)}

			{/* Directory browser dialog */}
			{dirBrowserOpen && (
				<Sheet open={dirBrowserOpen} onOpenChange={setDirBrowserOpen}>
					<SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
						<SheetHeader>
							<SheetTitle>Selecionar diretório</SheetTitle>
							<SheetDescription>Navegue e selecione o diretório para adicionar como local.</SheetDescription>
						</SheetHeader>

						<div className="flex-1 overflow-y-auto p-6">
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Input
										value={dirPath}
										onChange={(e) => setDirPath(e.target.value)}
										placeholder="Caminho do diretório"
										onKeyDown={(e) => {
											if (e.key === "Enter") browseDir(dirPath);
										}}
									/>
									<Button size="sm" onClick={() => browseDir(dirPath)}>
										<Icon name="search" size={14} />
									</Button>
								</div>

								{dirError && (
									<p className="text-caption" style={{ color: "var(--color-error)" }}>
										{dirError}
									</p>
								)}

									{dirLoading ? (
										<div className="flex items-center justify-center py-8">
											<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>Carregando...</span>
										</div>
								) : (
									<div className="space-y-1">
										{dirEntries.map((entry) => (
											<button
												key={entry.path}
												type="button"
												className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors ${
													selectedDir?.path === entry.path
														? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]"
														: "hover:bg-[var(--color-surface-secondary)]"
												}`}
												onClick={() => setSelectedDir(entry)}
											>
												<Icon name="folder" size={14} />
												<span className="truncate">{entry.name}</span>
											</button>
										))}
										{dirEntries.length === 0 && !dirError && (
											<p className="text-caption py-4 text-center" style={{ color: "var(--color-text-secondary)" }}>
												Nenhum subdiretório encontrado
											</p>
										)}
									</div>
								)}
							</div>
						</div>

						<SheetFooter>
							<Button variant="secondary" onClick={() => setDirBrowserOpen(false)}>
								Cancelar
							</Button>
							<Button disabled={!selectedDir} onClick={handleAddLocation}>
								Adicionar
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			)}
		</div>
	);
}
