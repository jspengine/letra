import { useState, useRef } from "react";
import { Button, Input, Textarea, Badge, Icon, Checkbox } from "@letra/ui";
import { cn } from "../../lib/utils";

interface Props {
	onComplete: (workflow: unknown) => void;
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

interface AgentPromptParams {
	dirs: string[];
	name: string;
	description: string;
	workspacePath: string;
}

const AGENT_PROMPTS: Record<string, (p: AgentPromptParams) => string> = {
	opencode: (p) => `Você é um arquiteto de software especializado em configurar o Letra (framework SDD — Specification-Driven Development) para novos workspaces.

## Missão
Analise profundamente o workspace em **${p.workspacePath}** e seus diret�rios monitorados (${p.dirs.join(", ")}) para gerar o harness completo do Letra � conjunto de arquivos de contexto que descrevem a arquitetura, decis�es, gloss�rio e fluxo de trabalho.

## Passos

### 1. Explorar o Workspace
- Varra todos os diretórios listados acima
- Identifique a stack principal (linguagem, framework, runtime, banco de dados)
- Detecte padrões de arquitetura (MVC, hexagonal, microsserviços, monólito, etc.)
- Mapeie a estrutura de diretórios e o propósito de cada módulo/pasta
- Identifique convenções de código (ESLint, Prettier, tsconfig, Dockerfile, CI/CD)
- Verifique se há package.json, Cargo.toml, pyproject.toml, Gemfile, go.mod, etc.
- Analise testes existentes (framework de teste, cobertura, padrões)

### 2. Gerar Constitution (${p.workspacePath}/.letra/constitution.md)
Regras n�o-negoci�veis do workspace:
- Stack e versões obrigatórias
- Padrões de arquitetura que devem ser seguidos
- Convenções de código (naming, organização de imports, testes)
- Regras de segurança (nunca expor secrets, validação de input, etc.)
- Práticas de CI/CD e deploy
- Como as specs devem ser escritas (thin specs, formato)

### 3. Gerar Context (${p.workspacePath}/.letra/context.md)
Vis�o geral do workspace:
- Intent: propósito do workspace "${p.name}" — ${p.description}
- Dom�nio: problema de neg�cio que o workspace resolve
- Stack técnica completa (linguagem, frameworks, banco, infra)
- Restrições reais (prazos, equipe, limitações técnicas)
- Decisões arquiteturais importantes (com links para ADRs)
- Glossário de termos específicos do domínio

### 4. Gerar Glossary (${p.workspacePath}/.letra/glossary.md)
- Termos técnicos e de domínio mapeados
- Abreviações e siglas usadas no projeto
- Nomes de módulos, pacotes e suas responsabilidades

### 5. Configurar Fluxo SDLC
- Crie ${p.workspacePath}/.letra/workflow.json com os estágios:
  - Backlog (todo)
  - Spec Draft (doing)
  - Spec Review (doing)
  - Code (doing)
  - Code Review (doing)
  - Ready to PR (doing)
  - Done (done)
- Para cada item existente no backlog, crie entries no workflow

### 6. Gerar Spec Inicial
- ${p.workspacePath}/.letra/specs/_template/spec.md — template de spec
- ${p.workspacePath}/.letra/specs/README.md — guia do diretório de specs

### 7. Adaptadores
Configure os adaptadores para: ${p.dirs.join(", ")}
- AGENTS.md (formato OpenCode)
- .cursorrules (formato Cursor)
- CLAUDE.md (formato Claude Code)
- .windsurfrules (formato Windsurf)
- .opencode/instructions.md (formato OpenCode)
- .github/copilot-instructions.md (formato GitHub Copilot)

Cada adaptador deve conter:
- Seção de contexto com os diretórios monitorados
- Comandos disponíveis (pulse, sitrep, flow move, health)
- Seção de item ativo (se houver)
- Regras de handoff entre agentes

## Formato de Saída
Gere todos os arquivos dentro de ${p.workspacePath}/.letra/. Retorne um resumo do que foi criado.`,

	cursor: (p) => `You are an expert software architect configuring the Letra framework (SDD — Specification-Driven Development) for a workspace.

## Mission
Deeply analyze the workspace at **${p.workspacePath}** and its monitored directories (${p.dirs.join(", ")}) to generate the complete Letra harness.

## Steps

### 1. Explore the Workspace
- Walk all listed directories
- Identify the main stack (language, framework, runtime, database)
- Detect architecture patterns (MVC, hexagonal, microservices, monolith, etc.)
- Map directory structure and each module's purpose
- Identify code conventions (linting, formatting, tsconfig, Dockerfile, CI/CD)
- Check for package.json, Cargo.toml, pyproject.toml, etc.
- Analyze existing tests (framework, coverage, patterns)

### 2. Generate Constitution
Non-negotiable workspace rules in ${p.workspacePath}/.letra/constitution.md

### 3. Generate Context
Workspace overview in ${p.workspacePath}/.letra/context.md including intent, domain, tech stack, constraints, architectural decisions.

### 4. Generate Glossary
Technical and domain terms in ${p.workspacePath}/.letra/glossary.md

### 5. Configure SDLC Flow
Workflow with stages: Backlog, Spec Draft, Spec Review, Code, Code Review, Ready to PR, Done.

### 6. Generate Spec Template
- ${p.workspacePath}/.letra/specs/_template/spec.md
- ${p.workspacePath}/.letra/specs/README.md

### 7. Configure .cursorrules
Generate .cursorrules with context, available commands, active item section, and handoff rules.

Return a summary of everything created.`,

	"claude-code": (p) => `You are configuring the Letra SDD framework for "${p.name}" at ${p.workspacePath}. Deeply analyze the workspace (${p.dirs.join(", ")}) — explore its stack, architecture, code conventions, and test patterns — then generate the complete Letra harness:

1. **${p.workspacePath}/.letra/constitution.md** — architecture rules, code conventions, security policies
2. **${p.workspacePath}/.letra/context.md** — workspace intent, domain, tech stack, constraints, decisions
3. **${p.workspacePath}/.letra/glossary.md** — domain and technical terms
4. **${p.workspacePath}/.letra/workflow.json** — SDLC stages
5. **${p.workspacePath}/.letra/specs/** — template and README
6. **CLAUDE.md** — Claude Code adapter with workspace context, available commands, active items, and handoff rules

For each file, reflect the actual project patterns you discover during exploration. The harness must match the real project profile.`,

	windsurf: (p) => `Configure the Letra SDD framework for "${p.name}" at ${p.workspacePath}. Explore the codebase in ${p.dirs.join(", ")}, identify stack, architecture, patterns, and generate the full Letra harness:

- .letra/constitution.md — rules and conventions
- .letra/context.md — workspace overview and decisions  
- .letra/glossary.md — terms
- .letra/workflow.json — SDLC pipeline
- .letra/specs/ — spec template
- .windsurfrules — Windsurf adapter with workspace context, commands, and handoff

Base every file on real project analysis, not generic templates.`,

	hermes: (p) => `Configure Letra for "${p.name}" at ${p.workspacePath}. Analyze ${p.dirs.join(", ")} deeply — stack, architecture, code style, tests — then generate:

- .letra/constitution.md, context.md, glossary.md
- .letra/workflow.json with SDLC stages
- .letra/specs/ template
- .hermes/instructions.md with workspace context, commands, and handoff rules

Tailor every file to the actual project profile found during exploration.`,

	vscode: (p) => `Configure Letra SDD for "${p.name}" at ${p.workspacePath}. Explore ${p.dirs.join(", ")}, detect tech stack, architecture, and conventions, then generate:

- .letra/constitution.md, context.md, glossary.md
- .letra/workflow.json
- .letra/specs/ template
- .vscode/settings.json with recommended extensions for the detected stack
- .vscode/copilot-instructions.md with workspace context

All files must reflect real project analysis, not generic templates.`,

	copilot: (p) => `Analyze the workspace "${p.name}" at ${p.workspacePath}. Walk directories ${p.dirs.join(", ")}, identify stack, architecture, patterns, and configure Letra:

- .letra/constitution.md — workspace rules
- .letra/context.md — intent, domain, stack, constraints
- .letra/glossary.md — terms
- .letra/workflow.json — SDLC stages
- .letra/specs/ — spec template
- .github/copilot-instructions.md — Copilot adapter with full workspace context

Infer everything from actual codebase analysis.`,
};

type Step = "name" | "directories" | "template" | "review" | "done";

interface DirNode {
	name: string;
	path: string;
	expanded: boolean;
	loading: boolean;
	children: DirNode[];
}

export default function InlineSetupWizard({ onComplete }: Props) {
	const [step, setStep] = useState<Step>("name");
	const stepOrder: Step[] = ["name", "directories", "template", "review"];
	const stepLabels: Record<Step, string> = {
		name: "Nome",
		directories: "Diretórios",
		template: "Template",
		review: "Revisão",
		done: "Concluído",
	};
	const currentIndex = stepOrder.indexOf(step);

	// ── Step 1 state ──
	const [workspaceName, setWorkspaceName] = useState("");
	const [description, setDescription] = useState("");
	const [workspacePath, setWorkspacePath] = useState("");
	const nameValid = workspaceName.trim().length > 0;
	const descValid = description.trim().length >= 10;
	const pathValid = workspacePath.trim().length > 0;
	const step1Valid = nameValid && descValid && pathValid;
	const wsBrowseRef = useRef<HTMLInputElement>(null);

	// ── Step 2 state ──
	const [selectedDirs, setSelectedDirs] = useState<string[]>([]);
	const [customDirInput, setCustomDirInput] = useState("");
	const [customDirs, setCustomDirs] = useState<string[]>([]);

	const [dirTrees, setDirTrees] = useState<DirNode[]>(
		COMMON_ROOTS.map((r) => ({ name: r.label, path: r.path, expanded: false, loading: false, children: [] })),
	);

	const allDirs = [...selectedDirs, ...customDirs];
	const step2Valid = allDirs.length >= 1;

	function toggleDir(path: string) {
		setSelectedDirs((prev) =>
			prev.includes(path) ? prev.filter((d) => d !== path) : [...prev, path],
		);
	}

	function addCustomDir() {
		const path = customDirInput.trim();
		if (path && !customDirs.includes(path) && !allDirs.includes(path)) {
			setCustomDirs([...customDirs, path]);
			setCustomDirInput("");
		}
	}

	function removeCustomDir(path: string) {
		setCustomDirs(customDirs.filter((d) => d !== path));
	}

	function handleWsBrowse(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (files && files.length > 0) {
			const relPath = (files[0] as any).webkitRelativePath as string | undefined;
			if (relPath) setWorkspacePath(relPath.split("/")[0]);
		}
	}

	async function toggleDirTree(node: DirNode) {
		if (node.expanded) {
			node.expanded = false;
			setDirTrees([...dirTrees]);
			return;
		}
		if (node.children.length === 0 && !node.loading) {
			node.loading = true;
			setDirTrees([...dirTrees]);
			try {
				const res = await fetch(`/api/fs/dirs?path=${encodeURIComponent(node.path)}`);
				const data = await res.json();
				node.children = (data.dirs || []).map((d: { name: string; path: string }) => ({
					name: d.name,
					path: d.path,
					expanded: false,
					loading: false,
					children: [],
				}));
			} catch {}
			node.loading = false;
		}
		node.expanded = true;
		setDirTrees([...dirTrees]);
	}

	// ── Step 3 state ──
	const [selectedTools, setSelectedTools] = useState<string[]>(["opencode"]);
	const step3Valid = selectedTools.length >= 1;

	function toggleTool(id: string) {
		setSelectedTools((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	}

	// ── Step 4 (review) — submission ──
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [generatedPrompt, setGeneratedPrompt] = useState("");
	const [createdWorkflow, setCreatedWorkflow] = useState<unknown>(null);

	async function createWorkflow() {
		setSubmitting(true);
		setSubmitError("");
		const body: Record<string, unknown> = {
			tools: selectedTools,
			name: workspaceName.trim(),
			description: description.trim(),
			workspacePath: workspacePath.trim(),
			directories: allDirs,
			template: "padrao",
		};
		try {
			const res = await fetch("/api/workflow/setup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			setSubmitting(false);
			if (data && !data.error) {
				setCreatedWorkflow(data);
				const primaryTool = selectedTools[0];
				const prompter = AGENT_PROMPTS[primaryTool] || AGENT_PROMPTS.opencode;
				setGeneratedPrompt(prompter({
					dirs: allDirs,
					name: workspaceName.trim(),
					description: description.trim(),
					workspacePath: workspacePath.trim(),
				}));
				setStep("done");
			} else {
				setSubmitError(data?.error || "Erro desconhecido ao criar workspace");
			}
		} catch (e) {
			setSubmitting(false);
			setSubmitError("Erro de conexão com o servidor");
		}
	}

	function goNext() {
		const idx = stepOrder.indexOf(step);
		if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
	}

	function goBack() {
		const idx = stepOrder.indexOf(step);
		if (idx > 0) setStep(stepOrder[idx - 1]);
	}

	function renderDirTree(nodes: DirNode[], depth = 0) {
		return nodes.map((node) => (
			<div key={node.path}>
				<div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
					<Button
						onClick={() => toggleDirTree(node)}
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
					<label className="flex items-center gap-2 flex-1 py-1 rounded cursor-pointer hover:bg-primary/5 px-1">
						<Checkbox
							checked={selectedDirs.includes(node.path)}
							onChange={() => toggleDir(node.path)}
						/>
						<Icon name="folder" size={14} className="text-primary shrink-0" />
						<span className="text-sm truncate">{node.name}</span>
						<span className="text-xs ml-auto shrink-0" style={{ color: "var(--muted-foreground)" }}>
							{node.path}
						</span>
					</label>
				</div>
				{node.expanded && node.children.length > 0 && renderDirTree(node.children, depth + 1)}
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

				{/* ═══ Step 1 — Name + Description + Path ═══ */}
				{step === "name" && (
					<div className="flex flex-col items-center text-center gap-6 pt-8 animate-fade-in">
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
							<Icon name="grid" size={24} className="text-primary" />
						</div>
						<div>
							<h1 className="text-3xl font-bold mb-2">Configurar Workspace</h1>
							<p className="text-muted-foreground text-base max-w-md">Defina o nome, descrição e local do workspace.</p>
						</div>
						<div className="w-full max-w-sm flex flex-col gap-4">
							<div className="flex flex-col gap-1.5 text-left">
								<label className="text-sm font-medium">Nome do workspace <span className="text-red-500">*</span></label>
								<Input placeholder="Ex: Meu Projeto" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
							</div>
							<div className="flex flex-col gap-1.5 text-left">
								<label className="text-sm font-medium">Descrição <span className="text-red-500">*</span></label>
								<Textarea className="w-full px-3 py-2 rounded-lg border text-sm resize-none" rows={3} placeholder="Descreva o propósito do workspace (mín. 10 caracteres)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
								{description.length > 0 && !descValid && <span className="text-xs text-red-500">Faltam {10 - description.trim().length} caracteres</span>}
							</div>
							<div className="flex flex-col gap-1.5 text-left">
								<label className="text-sm font-medium">Caminho do workspace <span className="text-red-500">*</span></label>
								<div className="flex gap-2">
									<Input placeholder="Ex: C:/MeusProjetos/meu-app" value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)} className="flex-1 font-mono text-xs" />
									<Input ref={wsBrowseRef} type="file" {...({ webkitdirectory: "" } as any)} style={{ display: "none" }} onChange={handleWsBrowse} />
									<Button variant="outline" size="sm" onClick={() => wsBrowseRef.current?.click()}>
										<Icon name="search" size={14} />
									</Button>
								</div>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Onde o <code>.letra/</code> será criado</p>
							</div>
							<Button className={btnClass} disabled={!step1Valid} onClick={goNext}>Próximo</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 2 — Directory Browser ═══ */}
				{step === "directories" && (
					<div className="flex flex-col gap-4 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Diretórios do Projeto</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Navegue e selecione os diretórios que o Letra deve monitorar.</p>
						</div>
						<div className="rounded-xl border p-2 max-h-64 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
							{renderDirTree(dirTrees)}
						</div>
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold">Adicionar outro diretório</h3>
							<div className="flex gap-2">
								<Input placeholder="Ex: D:/Projects" value={customDirInput} onChange={(e) => setCustomDirInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustomDir(); }} className="flex-1 font-mono text-xs" />
								<Button variant="outline" size="sm" onClick={addCustomDir} disabled={!customDirInput.trim()}>
									<Icon name="plus" size={14} className="mr-1" /> Adicionar
								</Button>
							</div>
							{customDirs.length > 0 && (
								<div className="flex flex-col gap-1 mt-1">
									{customDirs.map((d) => (
										<div key={d} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono" style={{ borderColor: "var(--border)" }}>
											<Icon name="folder" size={14} className="text-primary shrink-0" />
											<span className="flex-1">{d}</span>
											<Button onClick={() => removeCustomDir(d)} className="w-6 h-6 rounded hover:bg-red-500/10 hover:text-red-500" style={{ color: "var(--muted-foreground)" }} aria-label={`Remover ${d}`}>
												<Icon name="x" size={12} />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
						{!step2Valid && <p className="text-xs text-red-500">Selecione ou adicione pelo menos 1 diretório</p>}
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={goBack}>Voltar</Button>
							<Button disabled={!step2Valid} onClick={goNext} className={btnClass}>Próximo</Button>
						</div>
					</div>
				)}

				{/* ═══ Step 3 — Template + Tools ═══ */}
				{step === "template" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Template e Ferramentas</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Escolha o template de fluxo e as ferramentas agênticas.</p>
						</div>
						<div>
							<h3 className="text-sm font-semibold mb-2">Template de fluxo</h3>
							<div className="rounded-xl border border-primary bg-primary/5 ring-2 ring-primary/20 p-4">
								<div className="flex items-start gap-3">
									<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
										<Icon name="flow" size={16} className="text-primary" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-semibold">SDLC — Desenvolvimento de Software</span>
											<Badge variant="secondary">5 estágios</Badge>
										</div>
										<p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>Fluxo completo: Backlog, Design, Code, Review, Done</p>
										<div className="flex gap-1.5 mt-2 flex-wrap">
											{["Backlog", "Design", "Code", "Review", "Done"].map((s) => (
												<span key={s} className="text-xs px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">{s}</span>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
						<div>
							<div className="flex items-center gap-2 mb-2">
								<h3 className="text-sm font-semibold">Ferramentas agênticas</h3>
								{selectedTools.length > 0 && <Badge variant="secondary">{selectedTools.length} selecionada{selectedTools.length > 1 ? "s" : ""}</Badge>}
							</div>
							<div className="grid grid-cols-2 gap-3">
								{ADAPTERS.map((tool, i) => (
									<label key={tool.id} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-sm", selectedTools.includes(tool.id) ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50")}
										style={{ animation: `fade-in 0.2s ease-out ${i * 40}ms both` }}
									>
										<Checkbox checked={selectedTools.includes(tool.id)} onChange={() => toggleTool(tool.id)} />
										<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon name="code" size={16} className="text-primary" /></div>
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
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Confira os dados antes de finalizar.</p>
						</div>

						<div className="flex flex-col gap-4">
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Workspace</h3>
								<div className="text-sm space-y-1">
									<div><span style={{ color: "var(--muted-foreground)" }}>Nome:</span> <span className="font-medium">{workspaceName}</span></div>
									<div><span style={{ color: "var(--muted-foreground)" }}>Descrição:</span> {description}</div>
									<div><span style={{ color: "var(--muted-foreground)" }}>Caminho:</span> <span className="font-mono text-xs">{workspacePath}</span></div>
								</div>
							</div>
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Diretórios monitorados</h3>
								{allDirs.map((d) => (
									<div key={d} className="flex items-center gap-2 text-sm font-mono"><Icon name="folder" size={14} className="text-primary shrink-0" /><span>{d}</span></div>
								))}
							</div>
							<div className="p-4 rounded-xl" style={{ background: "var(--muted)" }}>
								<h3 className="text-sm font-semibold mb-2">Template e Ferramentas</h3>
								<div className="text-sm">SDLC — Desenvolvimento de Software</div>
								<div className="flex gap-2 flex-wrap mt-2">
									{selectedTools.map((t) => {
										const tool = ADAPTERS.find((a) => a.id === t);
										return tool ? <Badge key={t} variant="secondary">{tool.label}</Badge> : null;
									})}
								</div>
							</div>
						</div>

						{submitError && (
							<div className="p-3 rounded-lg text-sm text-red-500" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
								<Icon name="alert-triangle" size={14} className="inline mr-1" />
								{submitError}
							</div>
						)}

						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={goBack}>Voltar</Button>
							<Button disabled={submitting} onClick={createWorkflow} className={btnClass}>
								{submitting ? (
									<span className="flex items-center gap-2">
										<span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
										Criando...
									</span>
								) : "Finalizar"}
							</Button>
						</div>
					</div>
				)}

				{/* ═══ Done — Prompt ═══ */}
				{step === "done" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div className="flex flex-col items-center text-center gap-4">
							<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/20">
								<Icon name="check-circle" size={24} className="text-success" />
							</div>
							<div>
								<h2 className="text-2xl font-bold">Workspace criado!</h2>
								<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
									O workspace <strong>{workspaceName}</strong> foi registrado.
								</p>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
									Agora cole o prompt abaixo na sua ferramenta agêntica para gerar o harness Letra completo.
								</p>
							</div>
							{createdWorkflow ? (
								<Button onClick={() => onComplete(createdWorkflow)} className="mt-2">
									Abrir workspace
								</Button>
							) : null}
						</div>

						{generatedPrompt && (
							<div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
								<div className="flex items-center justify-between gap-2 p-4 border-b" style={{ borderColor: "var(--border)" }}>
									<div className="flex items-center gap-2">
										<Icon name="code" size={16} className="text-primary" />
										<h3 className="text-sm font-semibold">
											Prompt para {ADAPTERS.find((a) => a.id === selectedTools[0])?.label || selectedTools[0]}
										</h3>
									</div>
									<Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
										<Icon name="copy" size={14} className="mr-1" />
										Copiar
									</Button>
								</div>
								<div className="p-4">
									<p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
										Este prompt instrui o agente a analisar profundamente o projeto e configurar o harness Letra.
									</p>
									<pre className="text-xs p-4 rounded-lg whitespace-pre-wrap font-code leading-relaxed" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)", maxHeight: "50vh", overflowY: "auto" }}>
										{generatedPrompt}
									</pre>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}



