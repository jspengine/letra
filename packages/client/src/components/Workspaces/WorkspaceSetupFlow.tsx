import { useState, useCallback } from "react";
import { Button, Input, Textarea, Icon, Badge, Checkbox, useToast } from "@letra/ui";
import { cn } from "../../lib/utils";

interface WorkspaceData {
	name: string;
	description: string;
	workDir: string;
	targetFolders: string[];
	tools: string[];
}

interface Props {
	onComplete: (data: { name: string }) => void;
	onCancel: () => void;
	existingNames: string[];
}

const ADAPTERS = [
	{ id: "opencode", label: "OpenCode" },
	{ id: "cursor", label: "Cursor" },
	{ id: "claude-code", label: "Claude Code" },
	{ id: "windsurf", label: "Windsurf" },
	{ id: "hermes", label: "Hermes" },
	{ id: "vscode", label: "VS Code" },
	{ id: "copilot", label: "Copilot" },
];

const COMMON_ROOTS = [
	{ path: "C:/Workspace", label: "C:/Workspace" },
	{ path: "C:/Dev", label: "C:/Dev" },
	{ path: "C:/Projects", label: "C:/Projects" },
	{ path: "C:/Users", label: "C:/Users" },
	{ path: "D:/", label: "D:/" },
];

interface DirNode {
	name: string;
	path: string;
	expanded: boolean;
	loading: boolean;
	children: DirNode[];
}

type Step = "info" | "directories" | "tools" | "review" | "done";

export default function WorkspaceSetupFlow({ onComplete, onCancel, existingNames }: Props) {
	const [step, setStep] = useState<Step>("info");
	const stepOrder: Step[] = ["info", "directories", "tools", "review"];
	const stepLabels: Record<Step, string> = {
		info: "Informações",
		directories: "Diretórios",
		tools: "Ferramentas",
		review: "Revisão",
		done: "Concluído",
	};
	const currentIndex = stepOrder.indexOf(step);

	// ── Step 1: Info ──
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [nameError, setNameError] = useState("");

	const validateName = useCallback((value: string) => {
		const trimmed = value.trim();
		if (!trimmed) {
			setNameError("Nome é obrigatório");
			return false;
		}
		if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
			setNameError("Já existe um workspace com este nome");
			return false;
		}
		setNameError("");
		return true;
	}, [existingNames]);

	const step1Valid = name.trim().length > 0 && !nameError;

	function handleNameChange(value: string) {
		setName(value);
		if (nameError) validateName(value);
	}

	function handleNameBlur() {
		validateName(name);
	}

	// ── Step 2: Directories ──
	const [workDir, setWorkDir] = useState("");
	const [selectedDirs, setSelectedDirs] = useState<string[]>([]);
	const [workDirTrees, setWorkDirTrees] = useState<DirNode[]>(
		COMMON_ROOTS.map((r) => ({ name: r.label, path: r.path, expanded: false, loading: false, children: [] })),
	);
	const [targetDirTrees, setTargetDirTrees] = useState<DirNode[]>(
		COMMON_ROOTS.map((r) => ({ name: r.label, path: r.path, expanded: false, loading: false, children: [] })),
	);

	const step2Valid = workDir.trim().length > 0 && selectedDirs.length > 0;

	function toggleDirTree(nodes: DirNode[], setNodes: (n: DirNode[]) => void, node: DirNode) {
		if (node.expanded) {
			node.expanded = false;
			setNodes([...nodes]);
			return;
		}
		if (node.children.length === 0 && !node.loading) {
			node.loading = true;
			setNodes([...nodes]);
			fetch(`/api/fs/dirs?path=${encodeURIComponent(node.path)}`)
				.then((r) => r.json())
				.then((data) => {
					node.children = (data.dirs || []).map((d: { name: string; path: string }) => ({
						name: d.name,
						path: d.path,
						expanded: false,
						loading: false,
						children: [],
					}));
				})
				.catch(() => {})
				.finally(() => {
					node.loading = false;
					node.expanded = true;
					setNodes([...nodes]);
				});
		} else {
			node.expanded = true;
			setNodes([...nodes]);
		}
	}

	function toggleTargetDir(path: string) {
		setSelectedDirs((prev) =>
			prev.includes(path) ? prev.filter((d) => d !== path) : [...prev, path],
		);
	}

	// ── Step 3: Tools ──
	const [selectedTools, setSelectedTools] = useState<string[]>(["opencode"]);
	const step3Valid = selectedTools.length > 0;

	function toggleTool(id: string) {
		setSelectedTools((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	}

	// ── Navigation ──
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const { toast } = useToast();

	function goNext() {
		const idx = stepOrder.indexOf(step);
		if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
	}

	function goBack() {
		const idx = stepOrder.indexOf(step);
		if (idx > 0) setStep(stepOrder[idx - 1]);
		else onCancel();
	}

	function handleCreate() {
		if (!step2Valid || !step3Valid) return;
		setSubmitting(true);
		setSubmitError("");
		fetch("/api/workflow/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: name.trim(),
				description: description.trim(),
				workspacePath: workDir.trim(),
				directories: selectedDirs,
				tools: selectedTools,
				template: "padrao",
			}),
		})
			.then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
			.then(({ ok, status, data }) => {
				setSubmitting(false);
				if (data.workspace || data.version) {
					toast("Workspace criado com sucesso!", "success");
					onComplete({ name: name.trim() });
					setStep("done");
				} else {
					const keys = Object.keys(data).join(", ");
					setSubmitError(data.error || `Resposta inesperada (${status}, chaves: ${keys})`);
				}
			})
			.catch(() => {
				setSubmitting(false);
				setSubmitError("Erro de conexão com o servidor");
			});
	}

	function renderDirTree(nodes: DirNode[], setNodes: (n: DirNode[]) => void, mode: "single" | "multi") {
		return nodes.map((node) => (
			<div key={node.path}>
				<div className="flex items-center gap-1" style={{ paddingLeft: 0 }}>
					<Button
						onClick={() => toggleDirTree(nodes, setNodes, node)}
						className="flex items-center justify-center w-5 h-5 rounded hover:bg-primary/10 transition-colors shrink-0"
						aria-label={node.expanded ? "Recolher" : "Expandir"}
					>
						{node.loading ? (
							<span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
						) : (
							<Icon
								name="chevron-right"
								size={12}
								className={cn("transition-transform", node.expanded && "rotate-90")}
								style={node.children.length === 0 ? { opacity: 0.3 } : undefined}
							/>
						)}
					</Button>
					{mode === "multi" ? (
						<label className="flex items-center gap-2 flex-1 py-1 rounded cursor-pointer hover:bg-primary/5 px-1">
							<Checkbox
								checked={selectedDirs.includes(node.path)}
								onChange={() => toggleTargetDir(node.path)}
							/>
							<Icon name="folder" size={14} className="text-primary shrink-0" />
							<span className="text-sm truncate">{node.name}</span>
							<span className="text-xs ml-auto shrink-0" style={{ color: "var(--muted-foreground)" }}>
								{node.path}
							</span>
						</label>
					) : (
						<Button
							type="button"
							onClick={() => setWorkDir(node.path)}
							className={cn(
								"flex items-center gap-2 flex-1 py-1 rounded px-1 text-left transition-colors",
								workDir === node.path ? "bg-primary/10" : "hover:bg-primary/5",
							)}
						>
							<Icon name="folder" size={14} className="text-primary shrink-0" />
							<span className="text-sm truncate">{node.name}</span>
							<span className="text-xs ml-auto shrink-0" style={{ color: "var(--muted-foreground)" }}>
								{node.path}
							</span>
							{workDir === node.path && (
								<Icon name="check" size={14} className="shrink-0" style={{ color: "var(--primary)" }} />
							)}
						</Button>
					)}
				</div>
				{node.expanded && node.children.length > 0 && (
					<div style={{ paddingLeft: 20 }}>
						{renderDirTree(node.children, setNodes, mode)}
					</div>
				)}
			</div>
		));
	}

	const btnClass = "transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100";

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-2xl mx-auto flex flex-col gap-6">
				{/* ── Progress ── */}
				{step !== "done" && (
					<>
						<div className="flex items-center justify-center gap-0">
							{stepOrder.map((s, i) => (
								<div key={s} className="flex items-center">
									<Button
										onClick={() => { if (i < currentIndex) setStep(s); }}
										disabled={i > currentIndex}
										className={cn("w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-all", i === currentIndex && "ring-2 ring-primary/30", i < currentIndex && "cursor-pointer")}
										style={{
											background: i < currentIndex ? "var(--success)" : i === currentIndex ? "var(--primary)" : "var(--muted)",
											color: i < currentIndex ? "var(--success-foreground)" : i === currentIndex ? "var(--primary-foreground)" : "var(--muted-foreground)",
										}}
										aria-label={`Passo ${i + 1}: ${stepLabels[s]}${i < currentIndex ? " (concluído)" : ""}`}
									>
										{i < currentIndex ? <Icon name="check" size={14} /> : i + 1}
									</Button>
									{i < stepOrder.length - 1 && <div className="w-8 h-0.5 mx-1" style={{ background: i < currentIndex ? "var(--success)" : "var(--border)" }} />}
								</div>
							))}
						</div>
						<div className="flex justify-center gap-0 text-xs -mt-4" style={{ color: "var(--muted-foreground)" }}>
							{stepOrder.map((s, i) => (
								<div key={s} className="flex items-center">
									<span className={cn("px-1", i === currentIndex && "font-semibold text-primary")}>{stepLabels[s]}</span>
									{i < stepOrder.length - 1 && <span className="w-8" />}
								</div>
							))}
						</div>
					</>
				)}

				{/* ═══ Step 1 — Info ═══ */}
				{step === "info" && (
					<div className="flex flex-col items-center text-center gap-6 pt-8 animate-fade-in">
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
							<Icon name="grid" size={24} className="text-primary" />
						</div>
						<div>
							<h1 className="text-3xl font-bold mb-2">Novo Workspace</h1>
							<p className="text-base max-w-md" style={{ color: "var(--muted-foreground)" }}>
								Defina o nome e a descrição do seu workspace.
							</p>
						</div>
						<div className="w-full max-w-sm flex flex-col gap-4">
							<div className="flex flex-col gap-1.5 text-left">
								<label className="text-sm font-medium">
									Nome do workspace <span className="text-red-500">*</span>
								</label>
								<Input
									placeholder="Ex: Meu Projeto"
									value={name}
									onChange={(e) => handleNameChange(e.target.value)}
									onBlur={handleNameBlur}
									autoFocus
								/>
								{nameError && <span className="text-xs text-red-500">{nameError}</span>}
							</div>
							<div className="flex flex-col gap-1.5 text-left">
								<label className="text-sm font-medium">Descrição</label>
								<Textarea
									placeholder="Descreva o propósito do workspace..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
								/>
							</div>
							<Button className={btnClass} disabled={!step1Valid} onClick={goNext}>
								Próximo
							</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 2 — Directories ═══ */}
				{step === "directories" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Diretórios do Projeto</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Selecione o diretório de trabalho e as pastas alvo que o Letra deve monitorar.
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold flex items-center gap-2">
								Diretório de Trabalho <span className="text-red-500">*</span>
								{workDir && <Badge variant="secondary" className="text-[10px]">selecionado</Badge>}
							</h3>
							{workDir && (
								<div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
									<Icon name="folder" size={14} className="text-primary shrink-0" />
									<span className="flex-1 truncate">{workDir}</span>
									<Button
										type="button"
										onClick={() => setWorkDir("")}
										className="text-xs hover:underline"
										style={{ color: "var(--muted-foreground)" }}
									>
										Alterar
									</Button>
								</div>
							)}
							<div className="rounded-xl border p-2 max-h-48 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
								{renderDirTree(workDirTrees, setWorkDirTrees, "single")}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold flex items-center gap-2">
								Pastas Alvo <span className="text-red-500">*</span>
								{selectedDirs.length > 0 && <Badge variant="secondary" className="text-[10px]">{selectedDirs.length} selecionada{selectedDirs.length > 1 ? "s" : ""}</Badge>}
							</h3>
							<div className="rounded-xl border p-2 max-h-48 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
								{renderDirTree(targetDirTrees, setTargetDirTrees, "multi")}
							</div>
						</div>

						{!step2Valid && (
							<p className="text-xs text-red-500">
								{!workDir ? "Selecione um diretório de trabalho. " : ""}
								{selectedDirs.length === 0 ? "Selecione pelo menos 1 pasta alvo." : ""}
							</p>
						)}

						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={goBack}>Voltar</Button>
							<Button disabled={!step2Valid} onClick={goNext} className={btnClass}>Próximo</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 3 — Tools ═══ */}
				{step === "tools" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Ferramentas Agênticas</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Selecione as ferramentas de IA que este workspace utilizará.
							</p>
						</div>
						<div>
							<div className="flex items-center gap-2 mb-3">
								<h3 className="text-sm font-semibold">Adaptadores</h3>
								{selectedTools.length > 0 && <Badge variant="secondary">{selectedTools.length} selecionada{selectedTools.length > 1 ? "s" : ""}</Badge>}
							</div>
							<div className="grid grid-cols-2 gap-3">
								{ADAPTERS.map((tool, i) => (
									<label
										key={tool.id}
										className={cn(
											"flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-sm",
											selectedTools.includes(tool.id)
												? "border-primary bg-primary/5 ring-2 ring-primary/20"
												: "border-border hover:border-primary/50",
										)}
										style={{ animation: `fade-in 0.2s ease-out ${i * 40}ms both` }}
									>
										<Checkbox
											checked={selectedTools.includes(tool.id)}
											onChange={() => toggleTool(tool.id)}
										/>
										<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
											<Icon name="code" size={16} className="text-primary" />
										</div>
										<span className="font-medium">{tool.label}</span>
									</label>
								))}
							</div>
							{!step3Valid && <p className="text-xs text-red-500 mt-2">Selecione pelo menos 1 ferramenta</p>}
						</div>
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={goBack}>Voltar</Button>
							<Button disabled={!step3Valid} onClick={goNext} className={btnClass}>Revisar</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 4 — Review ═══ */}
				{step === "review" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Revisar Configuração</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Confira os dados antes de finalizar.
							</p>
						</div>

						<div className="flex flex-col gap-4">
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Workspace</h3>
								<div className="text-sm space-y-1">
									<div>
										<span style={{ color: "var(--muted-foreground)" }}>Nome:</span>{" "}
										<span className="font-medium">{name}</span>
									</div>
									{description && (
										<div>
											<span style={{ color: "var(--muted-foreground)" }}>Descrição:</span>{" "}
											{description}
										</div>
									)}
									<div>
										<span style={{ color: "var(--muted-foreground)" }}>Diretório de trabalho:</span>{" "}
										<span className="font-mono text-xs">{workDir}</span>
									</div>
								</div>
							</div>
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Pastas Alvo</h3>
								{selectedDirs.map((d) => (
									<div key={d} className="flex items-center gap-2 text-sm font-mono">
										<Icon name="folder" size={14} className="text-primary shrink-0" />
										<span>{d}</span>
									</div>
								))}
							</div>
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Ferramentas</h3>
								<div className="flex gap-2 flex-wrap mt-1">
									{selectedTools.map((t) => {
										const tool = ADAPTERS.find((a) => a.id === t);
										return tool ? <Badge key={t} variant="secondary">{tool.label}</Badge> : null;
									})}
								</div>
							</div>
						</div>

						{submitError && (
							<div className="p-3 rounded-lg text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--error)" }}>
								<Icon name="alert-triangle" size={14} className="inline mr-1" />
								{submitError}
							</div>
						)}

						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={goBack}>Voltar</Button>
							<Button disabled={submitting} onClick={handleCreate} className={btnClass}>
								{submitting ? (
									<span className="flex items-center gap-2">
										<span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
										Criando...
									</span>
								) : "Criar Workspace"}
							</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 5 — Done ═══ */}
				{step === "done" && (
					<div className="flex flex-col items-center text-center gap-6 pt-8 animate-fade-in">
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/20">
							<Icon name="check-circle" size={24} style={{ color: "var(--success)" }} />
						</div>
						<div>
							<h2 className="text-2xl font-bold">Workspace criado!</h2>
							<p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
								O workspace <strong>{name}</strong> foi registrado com sucesso.
							</p>
						</div>
						<Button onClick={onCancel} className="mt-2">
							Ir para Meus Workspaces
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
