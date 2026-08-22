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
	Dialog,
	useToast,
} from "@letra/ui";
import type { WorkspaceData } from "../WorkspacesView";

interface WorkflowLocation {
	id: string;
	path: string;
	label: string;
	adapters?: string[];
	linkStatus?: "ok" | "missing" | "broken" | "unknown";
	linkOk?: boolean;
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
	onCreateWorkspace?: () => void;
	onClose?: () => void;
}

export default function WorkspaceSettings({
	workspace,
	onWorkspaceUpdated,
	onWorkspaceDeleted,
	onRefreshWorkflow,
	onCreateWorkspace,
	onClose,
}: Props) {
	const { toast, toastWithOptions } = useToast();
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
	const [locationAdapters, setLocationAdapters] = useState<Record<string, string[]>>({});
	const [savingLocationAdapters, setSavingLocationAdapters] = useState(false);

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

	// Externalization state (ITEM-79)
	const [migrating, setMigrating] = useState(false);
	const [migrationError, setMigrationError] = useState("");

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
		toastWithOptions(`${label} — desfazer disponível por 30s`, {
			type: "success",
			duration: 30000,
			action: {
				label: "Desfazer",
				onClick: handleUndo,
			},
		});
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
			const locs = data.locations || [];
			setLocations(locs);
			const adaptersMap: Record<string, string[]> = {};
			for (const loc of locs) {
				if (loc.id) {
					adaptersMap[loc.id] = Array.isArray(loc.adapters) ? loc.adapters : [];
				}
			}
			setLocationAdapters(adaptersMap);
		} catch {
			setLocations([]);
			setLocationAdapters({});
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
		const previousLocation = locations.find((location) => location.id === locId);
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
			if (previousLocation) {
				showUndoToast("Label atualizado", () => {
					setLocations((prev) => prev.map((l) => (l.id === locId ? previousLocation : l)));
					fetch(`/api/workflow/locations/${locId}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ label: previousLocation.label }),
					});
				});
			} else {
				toast("Label atualizado", "success");
			}
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

	async function handleRepairLocation(locId: string) {
		const previousLocation = locations.find((location) => location.id === locId);
		try {
			const res = await fetch(`/api/workflow/locations/${locId}/repair-link`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Failed to repair link");
			const data = await res.json();
			if (data.location) {
				setLocations((prev) => prev.map((location) => (
					location.id === locId
						? { ...location, ...data.location, linkStatus: "ok", linkOk: true }
						: location
				)));
			} else if (previousLocation) {
				setLocations((prev) => prev.map((location) => (
					location.id === locId ? { ...location, linkStatus: "ok", linkOk: true } : location
				)));
			}
			toast("Vínculo reparado", "success");
		} catch {
			toast("Erro ao reparar vínculo", "error");
		}
	}

	function linkStatusLabel(location: WorkflowLocation) {
		if (location.linkOk === true || location.linkStatus === "ok") return "Vínculo ok";
		if (location.linkOk === false || location.linkStatus === "missing") return ".letra-link ausente";
		if (location.linkStatus === "broken") return ".letra-link quebrado";
		return "Vínculo não verificado";
	}

	function linkStatusTone(location: WorkflowLocation): "success" | "warning" | "info" {
		if (location.linkOk === true || location.linkStatus === "ok") return "success";
		if (location.linkOk === false || location.linkStatus === "missing" || location.linkStatus === "broken") return "warning";
		return "info";
	}

		const ALL_ADAPTERS = [
		{ id: "opencode", label: "OpenCode" },
		{ id: "cursor", label: "Cursor" },
		{ id: "codex", label: "Codex" },
		{ id: "claude-code", label: "Claude Code" },
		{ id: "vscode", label: "VS Code" },
		{ id: "windsurf", label: "Windsurf" },
		{ id: "hermes", label: "Hermes" },
		];

		async function handleToggleLocationAdapter(locId: string, adapterId: string) {
		const previous = locationAdapters[locId] || [];
		const next = previous.includes(adapterId)
			? previous.filter((id) => id !== adapterId)
			: [...previous, adapterId];
		setLocationAdapters((prev) => ({ ...prev, [locId]: next }));
		setSavingLocationAdapters(true);
		try {
			const res = await fetch(`/api/workflow/locations/${locId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ adapters: next }),
			});
			if (!res.ok) throw new Error("Failed to update adapters");
			showUndoToast("Adapters atualizados", () => {
				setLocationAdapters((prev) => ({ ...prev, [locId]: previous }));
				fetch(`/api/workflow/locations/${locId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ adapters: previous }),
				});
			});
		} catch {
			setLocationAdapters((prev) => ({ ...prev, [locId]: previous }));
			toast("Erro ao atualizar adapters", "error");
		} finally {
			setSavingLocationAdapters(false);
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
		const nextTemplate = templates.find((template) => template.id === selectedTemplate);
		const removedStages = prevStages.filter((stage) => !nextTemplate?.stages.some((candidate) => candidate.id === stage.id));
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
			if (removedStages.length > 0) {
				toast(`${removedStages.length} estágio(s) removido(s); itens preservados no backlog`, "success");
			}
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

	// ── Externalization (ITEM-79) ──

	async function handleMigrate() {
		if (!workspace.root || migrating) return;
		setMigrating(true);
		setMigrationError("");
		try {
			const res = await fetch("/api/workflow/migrate-harness", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ workspaceRoot: workspace.root, clean: false }),
			});
			if (!res.ok) throw new Error(`Migration failed (${res.status})`);
			const data = await res.json();
			if (data.ok) {
				toast("Workspace externalizado com sucesso", "success");
				onRefreshWorkflow();
			} else {
				setMigrationError(data.message || "Erro ao externalizar");
			}
		} catch (error: unknown) {
			setMigrationError((error as Error)?.message || "Erro ao externalizar");
		} finally {
			setMigrating(false);
		}
	}

	async function handleCleanMigrate() {
		if (!workspace.root || migrating) return;
		setMigrating(true);
		setMigrationError("");
		try {
			const res = await fetch("/api/workflow/migrate-harness", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ workspaceRoot: workspace.root, clean: true }),
			});
			if (!res.ok) throw new Error(`Migration failed (${res.status})`);
			const data = await res.json();
			if (data.ok) {
				toast("Workspace externalizado e pasta original removida", "success");
				onRefreshWorkflow();
			} else {
				setMigrationError(data.message || "Erro ao externalizar");
			}
		} catch (error: unknown) {
			setMigrationError((error as Error)?.message || "Erro ao externalizar");
		} finally {
			setMigrating(false);
		}
	}

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
		setDirPath("");
		setDirEntries([]);
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
					<div className="flex items-center gap-2">
						{onCreateWorkspace ? (
							<Button type="button" variant="secondary" onClick={onCreateWorkspace}>
								<Icon name="plus" size={14} />
								Novo workspace
							</Button>
						) : null}
						{activeTab === "general" && (
							<Button
								onClick={handleSave}
								disabled={!hasChanges || !nameValid || saving}
								loading={saving}
							>
								Salvar
							</Button>
						)}
						{onClose ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="size-8 px-0"
								aria-label="Fechar configurações do workspace"
								onClick={onClose}
							>
								<Icon name="x" size={16} />
							</Button>
						) : null}
					</div>
				</div>
			</div>

			{/* Tabs + content */}
			<div className="flex-1 overflow-y-auto p-6">
				<Tabs
					tabs={[
						{ id: "general", label: "Geral", icon: <Icon name="settings" size={14} /> },
						{ id: "locations", label: "Pastas/projetos", icon: <Icon name="folder" size={14} /> },
						{ id: "flow", label: "Fluxo", icon: <Icon name="flow" size={14} /> },
						{ id: "adapters", label: "Adapters", icon: <Icon name="cpu" size={14} /> },
												{ id: "advanced", label: "Avançado", icon: <Icon name="shield" size={14} /> },
												{ id: "externalization", label: "Externalização", icon: <Icon name="folder" size={14} /> },
											]}
					activeTab={activeTab}
					onChange={setActiveTab}
					ariaLabel="Configurações do workspace"
				>
					{(activeId) => (
						<div
							data-testid="workspace-settings-tab-panel"
							className="px-4 py-5 sm:px-6 lg:px-8"
						>
							{activeId === "general" && (
								<div className="space-y-6">
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
								<div className="space-y-4">
									<Label className="flex flex-col items-start gap-[var(--space-2)]">
										<span className="text-caption font-medium" style={{ color: "var(--color-text-secondary)" }}>
											Data directory do workspace
										</span>
										<Input value={workspace.dataDir || workspace.root || ""} readOnly aria-readonly="true" />
									</Label>
									<div className="flex items-center justify-between">
										<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Gerencie as pastas/projetos vinculadas a este workspace.
										</p>
										<Button size="sm" onClick={openDirBrowser}>
											<Icon name="plus" size={14} />
											Adicionar pasta
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
												Nenhuma pasta/projeto vinculada
											</p>
											<Button size="sm" className="mt-3" onClick={openDirBrowser}>
												Adicionar primeira pasta
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
																	aria-label={`Label do local ${loc.label}`}
																	autoFocus
																	onKeyDown={(e) => {
																		if (e.key === "Enter") handleSaveLabel(loc.id);
																		if (e.key === "Escape") setEditingLocationId(null);
																	}}
																/>
																<Button
																	size="sm"
																	variant="ghost"
																	aria-label={`Salvar local ${loc.label}`}
																	onClick={() => handleSaveLabel(loc.id)}
																>
																	<Icon name="check" size={14} />
																</Button>
																<Button
																	size="sm"
																	variant="ghost"
																	aria-label={`Cancelar edição de ${loc.label}`}
																	onClick={() => setEditingLocationId(null)}
																>
																	<Icon name="x" size={14} />
																</Button>
															</div>
														) : (
															<>
																<p className="text-sm font-medium truncate">{loc.label}</p>
																<p className="text-caption font-mono truncate" style={{ color: "var(--color-text-secondary)" }}>
																	{loc.path}
																</p>
																<span
																	className="mt-2 inline-flex rounded-full px-2 py-0.5 text-caption"
																	style={{
																		background: linkStatusTone(loc) === "success"
																			? "var(--color-success-subtle)"
																			: "var(--color-surface-secondary)",
																		color: linkStatusTone(loc) === "success"
																			? "var(--color-success)"
																			: "var(--color-text-secondary)",
																	}}
																>
																	{linkStatusLabel(loc)}
																</span>
																{!savingLocationAdapters && (
																	<details className="mt-2 rounded-[var(--radius-sm)] border p-2" style={{ borderColor: "var(--color-border)" }}>
																		<summary className="cursor-pointer text-caption font-medium">Adapters da pasta</summary>
																		<div className="mt-2 flex flex-wrap gap-2">
																			{ALL_ADAPTERS.map((adapter) => {
																				const selected = (locationAdapters[loc.id] || []).includes(adapter.id);
																				return (
																					<Button
																						key={adapter.id}
																						size="sm"
																						variant={selected ? "secondary" : "ghost"}
																						className="h-7 px-2"
																						aria-pressed={selected}
																						disabled={savingLocationAdapters}
																						onClick={() => handleToggleLocationAdapter(loc.id, adapter.id)}
																					>
																						{adapter.label}
																					</Button>
																				);
																			})}
																		</div>
																	</details>
																)}
															</>
														)}
													</div>
													{editingLocationId !== loc.id && (
														<div className="flex items-center gap-1">
															<Button
																size="sm"
																variant="ghost"
																aria-label={`Editar label da pasta ${loc.label}`}
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
																aria-label={`Reparar vínculo da pasta ${loc.label}`}
																onClick={() => handleRepairLocation(loc.id)}
															>
																<Icon name="activity" size={14} />
															</Button>
															<Button
																size="sm"
																variant="ghost"
																aria-label={`Remover vínculo da pasta ${loc.label}`}
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
								<div className="space-y-4">
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
												const unchangedStages = tpl.stages.filter((s) => currentStages.some((cs) => cs.id === s.id));

												return (
													<Button
														key={tpl.id}
														type="button"
														variant="ghost"
														className={`h-auto w-full flex-col items-stretch gap-2 rounded-[var(--radius-md)] border p-3 text-left ${
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
															<div className="text-caption flex flex-col gap-1" style={{ color: "var(--color-text-secondary)" }}>
																{unchangedStages.length > 0 && (
																	<p>
																		Inalterados: {unchangedStages.map((s) => s.name).join(", ")}
																	</p>
																)}
																{addedStages.length > 0 && (
																	<p style={{ color: "var(--color-success)" }}>
																		Adicionados: {addedStages.map((s) => s.name).join(", ")}
																	</p>
																)}
																{removedStages.length > 0 && (
																	<p style={{ color: "var(--color-error)" }}>
																		Removidos: {removedStages.map((s) => s.name).join(", ")}
																	</p>
																)}
																{removedStages.length > 0 && (
																	<p>
																		Itens nesses estágios serão preservados no backlog.
																	</p>
																)}
															</div>
														)}
													</Button>
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
								<div className="space-y-4">
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
													<Button
														key={adapter.id}
														type="button"
														variant="ghost"
														className={`h-auto w-full items-start justify-start gap-3 rounded-[var(--radius-md)] border p-3 text-left ${
															adapter.active
																? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
																: "hover:bg-[var(--color-surface-secondary)]"
														}`}
														style={{ borderColor: adapter.active ? undefined : "var(--color-border)" }}
														aria-label={`${adapter.active ? "Desativar" : "Ativar"} adapter ${adapter.displayName}`}
														aria-pressed={adapter.active}
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
															<p className="text-caption mt-1" style={{ color: "var(--color-text-secondary)" }}>
																Arquivo(s) esperado(s): {adapter.detectionPaths.join(", ")}
															</p>
														</div>
													</Button>
												);
											})}
										</div>
									)}
								</div>
							)}

							{activeId === "advanced" && (
								<div className="space-y-4">
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
							{activeId === "externalization" && (
								<div className="space-y-6">
									<h2 className="text-sm font-semibold">Externalização de dados</h2>
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
										Os arquivos do workspace (workflow.json, harness, specs, memories) podem ser externalizados para fora do projeto, mantendo apenas o link .le.etra-link.
									</p>
									{workspace.dataDir ? (
										<div className="text-caption break-all" style={{ color: "var(--color-text-secondary)" }}>{workspace.dataDir}</div>
									) : (
										<Button size="sm" variant="secondary" onClick={onRefreshWorkflow}>Atualizar localização</Button>
									)}

									{migrationError && (<p className="text-caption" style={{ color: "var(--color-error)" }}>{migrationError}</p>)}
									<div className="flex items-center gap-2">
										<Button size="sm" loading={migrating} onClick={handleMigrate}>Migrar para diretório externo</Button>
										<Button size="sm" variant="secondary" loading={migrating} onClick={handleCleanMigrate}>Migrar e remover origem</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</Tabs>
			</div>

			{/* Delete workspace dialogs */}
			{deleteStep === "confirm" && (
				<Dialog
					open={showDeleteConfirm}
					onClose={() => setShowDeleteConfirm(false)}
					title="Excluir workspace?"
					actions={
						<>
							<Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
								Cancelar
							</Button>
							<Button type="button" variant="danger" onClick={() => setDeleteStep("type-name")}>
								Continuar
							</Button>
						</>
					}
				>
					<p className="text-body" style={{ color: "var(--color-text-secondary)" }}>
						Tem certeza que deseja excluir "{workspace.name}"? Esta ação é irreversível.
					</p>
				</Dialog>
			)}

			{deleteStep === "type-name" && (
				<Dialog
					open={showDeleteConfirm}
					onClose={() => {
						setShowDeleteConfirm(false);
						setDeleteStep("confirm");
						setDeleteInput("");
					}}
					title={`Digite "${workspace.name}" para confirmar`}
					actions={
						<>
							<Button
								type="button"
								variant="secondary"
								onClick={() => {
									setShowDeleteConfirm(false);
									setDeleteStep("confirm");
									setDeleteInput("");
								}}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								variant="danger"
								disabled={deleteInput !== workspace.name}
								onClick={handleDelete}
							>
								Excluir permanentemente
							</Button>
						</>
					}
				>
					<div className="grid gap-3">
						<p className="text-body" style={{ color: "var(--color-text-secondary)" }}>
							Todos os dados serão preservados no disco, mas o registro será removido.
						</p>
						<Label className="flex flex-col items-start gap-[var(--space-2)]">
							<span className="text-caption font-medium" style={{ color: "var(--color-text-secondary)" }}>
								Nome do workspace
							</span>
							<Input
								value={deleteInput}
								onChange={(event) => setDeleteInput(event.target.value)}
								aria-label="Digite o nome do workspace para confirmar exclusão"
								placeholder={workspace.name}
								autoFocus
							/>
						</Label>
					</div>
				</Dialog>
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
										aria-label="Caminho do diretório"
										placeholder="Caminho do diretório"
										onKeyDown={(e) => {
											if (e.key === "Enter") browseDir(dirPath);
										}}
									/>
									<Button size="sm" aria-label="Buscar diretório" onClick={() => browseDir(dirPath)}>
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
											<Button
												key={entry.path}
												type="button"
												variant="ghost"
												className={`h-auto w-full justify-start gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm ${
													selectedDir?.path === entry.path
														? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]"
														: "hover:bg-[var(--color-surface-secondary)]"
												}`}
												onClick={() => setSelectedDir(entry)}
											>
												<Icon name="folder" size={14} />
												<span className="truncate">{entry.name}</span>
											</Button>
										))}
										{selectedDir && (
											<div className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: "var(--color-border)" }}>
												<p className="text-caption font-medium">Diretório selecionado</p>
												<p className="mt-1 truncate font-mono text-caption" style={{ color: "var(--color-text-secondary)" }}>
													{selectedDir.path}
												</p>
											</div>
										)}
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
