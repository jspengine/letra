import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { Badge, Button, Label, RadioGroup, RadioGroupItem } from "@letra/ui";
import { PersonalizationWizard } from "./PersonalizationWizard";
import { TEMPLATES, type WorkflowTemplate } from "./templates";

interface SetupWizardProps {
	onComplete: (templateId: string) => void;
	onPersonalizedComplete: (workflow: unknown) => void;
}

export function SetupWizard({ onComplete, onPersonalizedComplete }: SetupWizardProps) {
	const [selected, setSelected] = useState<string | null>(null);
	const [personalizing, setPersonalizing] = useState(false);
	const [templates, setTemplates] = useState<WorkflowTemplate[]>(TEMPLATES);

	useEffect(() => {
		fetch("/api/harness/templates")
			.then((response) => response.json())
			.then((data) => {
				if (!Array.isArray(data) || data.length === 0) return;
				const harnessTemplates: WorkflowTemplate[] = data.map((template: any) => ({
					id: String(template.id),
					name: String(template.name ?? template.id),
					description: String(template.description ?? ""),
					icon: "cross",
					stages: Array.isArray(template.stages)
						? template.stages.map((stage: any) => ({
							id: String(stage.id),
							name: String(stage.name ?? stage.id),
							zone: stage.zone === "todo" || stage.zone === "doing" || stage.zone === "done"
								? stage.zone
								: undefined,
						}))
						: [],
				}));
				setTemplates([
					...harnessTemplates,
					TEMPLATES.find((template) => template.id === "personalizado") ?? {
						id: "personalizado",
						name: "Personalizar",
						description: "Monte seu próprio fluxo.",
						icon: "settings",
						stages: [],
					},
				]);
			})
			.catch(() => {
				setTemplates(TEMPLATES);
			});
	}, []);

	if (personalizing) {
		return (
			<PersonalizationWizard
				onComplete={(stages) => {
					fetch("/api/workflow/template", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							stages: stages.map((s) => ({ id: s.id, name: s.name, zone: s.zone })),
						}),
					})
						.then((r) => r.json())
						.then((data) => {
							if (data && !data.error) {
								onPersonalizedComplete(data);
							}
						});
				}}
				onBack={() => setPersonalizing(false)}
			/>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-8">
			<div className="max-w-2xl w-full">
				<div className="text-center mb-10">
					<div className="inline-flex items-center justify-center w-14 h-14 rounded-[var(--radius-lg)] bg-primary/10 mb-4">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="w-7 h-7 text-primary"
							aria-hidden="true"
						>
							<path d="M16 3h5v5" />
							<path d="M8 3H3v5" />
							<path d="M3 16v5h5" />
							<path d="M16 21h5v-5" />
							<path d="M3 12h3" />
							<path d="M18 12h3" />
							<path d="M12 3v3" />
							<path d="M12 18v3" />
						</svg>
					</div>
					<h1 className="text-3xl font-bold mb-2">Bem-vindo ao Letra Flow</h1>
					<p className="text-muted-foreground text-base max-w-md mx-auto">
						Organize seu trabalho com um fluxo visual. Escolha um template para começar
						ou crie o seu do zero.
					</p>
				</div>

				<RadioGroup
					value={selected ?? ""}
					onValueChange={setSelected}
					className="grid gap-4"
					aria-label="Template de workflow"
				>
					{templates.map((t) => (
						<Label
							key={t.id}
							className={cn(
								"relative block w-full cursor-pointer rounded-[var(--radius-md)] border p-5 text-left transition-all",
								selected === t.id
									? "border-primary bg-primary/5 ring-2 ring-primary/20"
									: "border-border bg-card hover:border-primary/50 hover:bg-muted/30",
							)}
						>
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 rounded-[var(--radius-sm)] bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.75"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="w-5 h-5 text-primary"
										aria-hidden="true"
									>
										<path d={t.icon} />
									</svg>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="font-semibold text-foreground">
											{t.name}
										</span>
										{t.stages.length > 0 && (
											<Badge variant="info">
												{t.stages.length} estágios
											</Badge>
										)}
										{t.id === "personalizado" && (
											<Badge variant="amber">Do zero</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground">{t.description}</p>
									{t.stages.length > 0 && (
										<div className="flex gap-1.5 mt-3">
											{t.stages.map((s) => (
												<span
													key={s.id}
													className={cn(
														"text-xs px-2 py-0.5 rounded-full border",
														s.zone === "todo"
															? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
															: s.zone === "doing"
																? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
																: "border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10",
													)}
												>
													{s.name}
												</span>
											))}
										</div>
									)}
								</div>
								<RadioGroupItem value={t.id} aria-label={t.name} />
							</div>
						</Label>
					))}
				</RadioGroup>

				<div className="mt-8 flex justify-center">
					<Button
						size="lg"
						disabled={!selected}
						onClick={() => {
							if (selected === "personalizado") {
								setPersonalizing(true);
							} else if (selected) {
								onComplete(selected);
							}
						}}
					>
						{selected === "personalizado"
							? "Criar do zero"
							: "Começar com este template"}
					</Button>
				</div>
			</div>
		</div>
	);
}
