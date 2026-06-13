import { useCallback, useState } from "react";
import { Button, Input, Badge, Card, CardContent, Icon } from "@letra/ui";
import { TEMPLATES } from "./templates";
import { cn } from "../../lib/utils";

interface StageDef {
	id: string;
	name: string;
	zone: "todo" | "doing" | "done";
}

interface Props {
	onComplete: (workflow: unknown) => void;
}

let stageCounter = 0;
function freshId(prefix = "stage"): string {
	stageCounter++;
	return `${prefix}-${stageCounter}`;
}

const DEFAULT_STAGES: StageDef[] = [
	{ id: "backlog", name: "Backlog", zone: "todo" },
	{ id: "design", name: "Design", zone: "doing" },
	{ id: "code", name: "Code", zone: "doing" },
	{ id: "review", name: "Review", zone: "doing" },
	{ id: "done", name: "Done", zone: "done" },
];

const TOOLS = [
	{ id: "opencode", label: "OpenCode", icon: "code" as const },
	{ id: "cursor", label: "Cursor", icon: "edit" as const },
	{ id: "claude-code", label: "Claude Code", icon: "help" as const },
	{ id: "windsurf", label: "Windsurf", icon: "chevron-right" as const },
	{ id: "vscode", label: "VS Code", icon: "code" as const },
];

type Step = "welcome" | "template" | "customize" | "tools" | "review";

export default function InlineSetupWizard({ onComplete }: Props) {
	const [step, setStep] = useState<Step>("welcome");

	const stepOrder: Step[] = ["welcome", "template", "customize", "tools", "review"];
	const stepLabels: Record<Step, string> = {
		welcome: "Boas-vindas",
		template: "Template",
		customize: "Estágios",
		tools: "Ferramentas",
		review: "Revisão",
	};
	const currentIndex = stepOrder.indexOf(step);
	const [projectName, setProjectName] = useState("");
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
	const [stages, setStages] = useState<StageDef[]>(DEFAULT_STAGES);
	const [selectedTools, setSelectedTools] = useState<string[]>(["opencode"]);

	function createWorkflow(data: { template?: string; stages?: StageDef[]; tools?: string[] }) {
		const body: Record<string, unknown> = { tools: selectedTools, name: projectName || undefined };
		if (data.stages) {
			body.stages = data.stages.map((s) => ({ id: s.id, name: s.name, zone: s.zone }));
		} else if (data.template) {
			body.template = data.template;
		}
		fetch("/api/workflow/template", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
			.then((r) => r.json())
			.then((data) => {
				if (data && !data.error) onComplete(data);
			});
	}

	function toggleTool(id: string) {
		setSelectedTools((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	}

	function addStage() {
		setStages([...stages, { id: freshId(), name: "", zone: "doing" }]);
	}

	function removeStage(id: string) {
		setStages(stages.filter((s) => s.id !== id));
	}

	function renameStage(id: string, name: string) {
		setStages(stages.map((s) => (s.id === id ? { ...s, name } : s)));
	}

	function setZone(id: string, zone: "todo" | "doing" | "done") {
		setStages(stages.map((s) => (s.id === id ? { ...s, zone } : s)));
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-2xl mx-auto flex flex-col gap-8">

				{/* ── Step Progress ── */}
				<div className="flex items-center justify-center gap-0">
					{stepOrder.map((s, i) => (
						<div key={s} className="flex items-center">
							<button
								onClick={() => {
									if (i < currentIndex) setStep(s);
								}}
								disabled={i > currentIndex}
								className={cn(
									"w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-all duration-300",
									"hover:scale-110 active:scale-95",
									i === currentIndex ? "ring-2 ring-primary/30" : "cursor-default",
									i < currentIndex ? "cursor-pointer" : "",
								)}
								style={{
									background: i < currentIndex ? "var(--success)" : i === currentIndex ? "var(--primary)" : "var(--muted)",
									color: i < currentIndex ? "var(--success-foreground)" : i === currentIndex ? "var(--primary-foreground)" : "var(--muted-foreground)",
								}}
								aria-label={`Passo ${i + 1}: ${stepLabels[s]}${i < currentIndex ? " (concluído)" : ""}`}
							>
								{i < currentIndex ? <Icon name="check" size={14} /> : i + 1}
							</button>
							{i < stepOrder.length - 1 && (
								<div
									className="w-8 h-0.5 mx-1 transition-colors duration-300"
									style={{ background: i < currentIndex ? "var(--success)" : "var(--border)" }}
								/>
							)}
						</div>
					))}
				</div>
				<div className="flex justify-center gap-0 text-xs -mt-4" style={{ color: "var(--muted-foreground)" }}>
					{stepOrder.map((s, i) => (
						<div key={s} className="flex items-center" style={{ width: i === 0 || i === stepOrder.length - 1 ? "auto" : undefined }}>
							<span className={cn("px-1 transition-all duration-300", i === currentIndex ? "font-semibold text-primary" : "")}>
								{stepLabels[s]}
							</span>
							{i < stepOrder.length - 1 && <span className="w-8" />}
						</div>
					))}
				</div>

				{/* ── Welcome ── */}
				{step === "welcome" && (
					<div className="flex flex-col items-center text-center gap-6 pt-12 animate-fade-in">
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 transition-transform duration-300 hover:scale-110">
							<Icon name="grid" size={24} className="text-primary" />
						</div>
						<div>
							<h1 className="text-3xl font-bold mb-2">Bem-vindo ao Letra</h1>
							<p className="text-muted-foreground text-base max-w-md">
								Seu hub de specs e contexto para IA. Organize seu fluxo de trabalho e mantenha seus agentes alinhados.
							</p>
						</div>
						<div className="w-full max-w-sm flex flex-col gap-3">
							<Input
								placeholder="Nome do projeto (opcional)"
								value={projectName}
								onChange={(e) => setProjectName(e.target.value)}
							/>
							<Button className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" onClick={() => setStep("template")}>
								Começar
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-4 text-sm w-full max-w-md">
							{[
								{ icon: "edit" as const, text: "Escrever specs para suas features" },
								{ icon: "flow" as const, text: "Organizar o fluxo de trabalho" },
								{ icon: "context" as const, text: "Alimentar agentes de IA com contexto" },
								{ icon: "bar-chart" as const, text: "Acompanhar métricas e drift" },
							].map((item, i) => (
								<div
									key={item.text}
									className="flex items-center gap-2 p-3 rounded-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 cursor-default"
									style={{
										background: "var(--muted)",
										animation: `fade-in 0.3s ease-out ${i * 80}ms both`,
									}}
								>
									<div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
										<Icon name={item.icon} size={14} className="text-primary" />
									</div>
									<span style={{ color: "var(--muted-foreground)" }}>{item.text}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Template Selection ── */}
				{step === "template" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Escolha um template</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Selecione um fluxo para começar ou personalize o seu.
							</p>
						</div>
						<div className="flex flex-col gap-3">
							{TEMPLATES.map((t, i) => (
								<button
									key={t.id}
									onClick={() => setSelectedTemplate(t.id)}
									className={cn(
										"w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer",
										"hover:scale-[1.01] hover:shadow-md active:scale-[0.99]",
										selectedTemplate === t.id
											? "border-primary bg-primary/5 ring-2 ring-primary/20"
											: "border-border bg-card hover:border-primary/50",
									)}
									style={{ animation: `fade-in 0.3s ease-out ${i * 80}ms both` }}
								>
									<div className="flex items-start gap-3">
										<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110">
											<Icon name={t.icon} size={16} className="text-primary" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<span className="font-semibold">{t.name}</span>
												{t.stages.length > 0 && <Badge variant="secondary">{t.stages.length} estágios</Badge>}
											</div>
											<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t.description}</p>
											{t.stages.length > 0 && (
												<div className="flex gap-1.5 mt-2 flex-wrap">
													{t.stages.map((s) => (
														<span key={s.id} className={cn(
															"text-xs px-2 py-0.5 rounded-full border transition-all duration-200",
															s.zone === "todo" ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
																: s.zone === "doing" ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
																	: "border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10",
														)}>{s.name}</span>
													))}
												</div>
											)}
										</div>
									</div>
								</button>
							))}
						</div>
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={() => setStep("welcome")}>Voltar</Button>
							{selectedTemplate === "personalizado" ? (
								<Button onClick={() => setStep("customize")}>Personalizar estágios</Button>
							) : (
								<Button disabled={!selectedTemplate} onClick={() => setStep("tools")}>Próximo</Button>
							)}
						</div>
					</div>
				)}

				{/* ── Customize Stages ── */}
				{step === "customize" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Configure os estágios</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Defina as etapas do seu fluxo de trabalho.
							</p>
						</div>
						<div className="flex flex-col gap-2">
							{stages.map((s, i) => (
								<Card key={s.id} className="transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
									<CardContent className="p-3 flex items-center gap-2">
										<Input
											value={s.name}
											onChange={(e) => renameStage(s.id, e.target.value)}
											placeholder="Nome do estágio"
											className="flex-1"
										/>
										<div className="flex gap-1 shrink-0">
											{zones.map((z) => (
												<button
													key={z}
													onClick={() => setZone(s.id, z)}
													className={cn(
														"text-xs px-2 py-1 rounded-full border transition-all duration-200 hover:scale-105",
														s.zone === z ? zoneColors[z] : "border-border text-muted-foreground hover:border-foreground/30",
													)}
												>
													{z === "todo" ? "A fazer" : z === "doing" ? "Fazendo" : "Feito"}
												</button>
											))}
										</div>
										<button
											onClick={() => removeStage(s.id)}
											className="flex items-center justify-center w-7 h-7 rounded hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
											style={{ color: "var(--muted-foreground)" }}
											aria-label={`Remover estágio ${s.name || "sem nome"}`}
										>
											<Icon name="x" size={14} />
										</button>
									</CardContent>
								</Card>
							))}
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={addStage}
							className="self-start transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
						>
							<Icon name="plus" size={14} className="mr-1" />
							Adicionar estágio
						</Button>
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={() => setStep("template")}>Voltar</Button>
							<Button onClick={() => setStep("tools")}>Próximo</Button>
						</div>
					</div>
				)}

				{/* ── Tools ── */}
				{step === "tools" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Ferramentas de IA</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Selecione quais ferramentas de IA você usa. O Letra gerará adaptadores para cada uma.
							</p>
						</div>
						<div className="grid grid-cols-2 gap-3">
							{TOOLS.map((tool, i) => (
								<button
									key={tool.id}
									onClick={() => toggleTool(tool.id)}
									className={cn(
										"flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left",
										"hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]",
										selectedTools.includes(tool.id)
											? "border-primary bg-primary/5 ring-2 ring-primary/20"
											: "border-border hover:border-primary/50",
									)}
									style={{ animation: `fade-in 0.3s ease-out ${i * 60}ms both` }}
								>
									<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 transition-transform duration-200">
										<Icon name={tool.icon} size={16} className="text-primary" />
									</div>
									<span className="font-medium">{tool.label}</span>
								</button>
							))}
						</div>
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={() => selectedTemplate === "personalizado" ? setStep("customize") : setStep("template")}>Voltar</Button>
							<Button onClick={() => setStep("review")}>Revisar</Button>
						</div>
					</div>
				)}

				{/* ── Review ── */}
				{step === "review" && (
					<div className="flex flex-col gap-6 pt-4 animate-fade-in">
						<div>
							<h2 className="text-xl font-bold">Revise e comece</h2>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								Confira as configurações antes de criar o workflow.
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<div>
								<h3 className="text-sm font-semibold mb-2">Template</h3>
								{TEMPLATES.filter((t) => t.id === selectedTemplate).map((t) => {
									const stages = selectedTemplate !== "personalizado" ? t.stages : [];
									return (
										<div key={t.id}>
											<div className="p-3 rounded-lg transition-all duration-200 hover:shadow-sm" style={{ background: "var(--muted)" }}>
												<div className="font-medium">{t.name}</div>
												<div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t.description}</div>
											</div>
											{stages.length > 0 && (
												<div className="flex gap-2 mt-2 flex-wrap">
													{stages.map((s) => (
														<Badge key={s.id} variant="secondary">{s.name}</Badge>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
							<div>
								<h3 className="text-sm font-semibold mb-2">Adaptadores</h3>
								<div className="flex gap-2 flex-wrap">
									{selectedTools.map((t) => {
										const tool = TOOLS.find((tl) => tl.id === t);
										return tool ? <Badge key={t} variant="secondary">{tool.label}</Badge> : null;
									})}
								</div>
							</div>
						</div>
						<div className="flex gap-2 justify-between">
							<Button variant="ghost" onClick={() => setStep("tools")}>Voltar</Button>
							<Button onClick={() => {
								if (selectedTemplate === "personalizado") {
									createWorkflow({ stages: stages.filter((s) => s.name.trim()), tools: selectedTools });
								} else {
									createWorkflow({ template: selectedTemplate!, tools: selectedTools });
								}
							}}>
								Criar workflow
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

const zones: ("todo" | "doing" | "done")[] = ["todo", "doing", "done"];
const zoneColors: Record<string, string> = {
	todo: "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
	doing: "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	done: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
};
