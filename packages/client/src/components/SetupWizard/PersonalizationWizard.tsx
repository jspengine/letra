import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@letra/ui";

interface StageDef {
	id: string;
	name: string;
	zone: "todo" | "doing" | "done";
}

function defaultStages(): StageDef[] {
	return [
		{ id: "todo", name: "A Fazer", zone: "todo" },
		{ id: "doing", name: "Fazendo", zone: "doing" },
		{ id: "done", name: "Feito", zone: "done" },
	];
}

let stageCounter = 0;
function freshId(prefix = "stage"): string {
	stageCounter++;
	return `${prefix}-${stageCounter}`;
}

function ZoneBadge({ zone }: { zone: string }) {
	const colors: Record<string, string> = {
		todo: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10",
		doing: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
		done: "border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10",
	};
	return (
		<span
			className={`text-xs px-2 py-0.5 rounded-full border ${colors[zone] || colors.doing}`}
		>
			{zone === "todo" ? "A fazer" : zone === "doing" ? "Fazendo" : "Feito"}
		</span>
	);
}

// ── Step 1: Stages ──────────────────────────────────────────
function StepStages({
	stages,
	onChange,
}: {
	stages: StageDef[];
	onChange: (s: StageDef[]) => void;
}) {
	function addStage() {
		onChange([
			...stages,
			{ id: freshId(), name: "", zone: "doing" },
		]);
	}
	function removeStage(id: string) {
		onChange(stages.filter((s) => s.id !== id));
	}
	function rename(id: string, name: string) {
		onChange(stages.map((s) => (s.id === id ? { ...s, name } : s)));
	}

	return (
		<div>
			<h2 className="text-xl font-bold mb-1">Configure os estágios</h2>
			<p className="text-sm text-muted-foreground mb-6">
				Defina as etapas do seu fluxo de trabalho. Adicione, renomeie ou remova
				estágios.
			</p>

			<div className="flex flex-col gap-2 mb-4">
				{stages.map((s) => (
					<Card key={s.id}>
						<CardContent className="p-3 flex items-center gap-3">
							<input
								type="text"
								value={s.name}
								onChange={(e) => rename(s.id, e.target.value)}
								placeholder="Nome do estágio"
								className="flex-1 rounded px-2 py-1 text-sm border"
								style={{
									background: "var(--background)",
									borderColor: "var(--border)",
									color: "var(--foreground)",
								}}
							/>
							<button
								type="button"
								onClick={() => removeStage(s.id)}
								className="text-xs px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-500"
								style={{ color: "var(--muted-foreground)" }}
							>
								✕
							</button>
						</CardContent>
					</Card>
				))}
			</div>

			<Button variant="outline" size="sm" onClick={addStage}>
				+ Adicionar estágio
			</Button>
		</div>
	);
}

// ── Step 2: Zones ────────────────────────────────────────────
function StepZones({
	stages,
	onChange,
}: {
	stages: StageDef[];
	onChange: (s: StageDef[]) => void;
}) {
	function setZone(id: string, zone: "todo" | "doing" | "done") {
		onChange(stages.map((s) => (s.id === id ? { ...s, zone } : s)));
	}

	return (
		<div>
			<h2 className="text-xl font-bold mb-1">Organize em zonas</h2>
			<p className="text-sm text-muted-foreground mb-6">
				Cada estágio pertence a uma zona visual no dashboard: A fazer, Em
				andamento ou Feito.
			</p>

			<div className="flex flex-col gap-2">
				{stages.map((s) => (
					<Card key={s.id}>
						<CardContent className="p-3 flex items-center justify-between">
							<span className="text-sm font-medium">{s.name}</span>
							<div className="flex gap-1">
								{(["todo", "doing", "done"] as const).map((z) => (
									<button
										type="button"
										key={z}
										onClick={() => setZone(s.id, z)}
										className={`text-xs px-3 py-1 rounded-full border transition-all ${
											s.zone === z
												? z === "todo"
													? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
													: z === "doing"
														? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
														: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
												: "border-border text-muted-foreground hover:border-foreground/30"
										}`}
									>
										{z === "todo"
											? "A fazer"
											: z === "doing"
												? "Fazendo"
												: "Feito"}
									</button>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

// ── Step 3: Review ───────────────────────────────────────────
function StepReview({ stages }: { stages: StageDef[] }) {
	const validStages = stages.filter((s) => s.name.trim().length > 0);
	const todas = validStages.filter((s) => s.zone === "todo");
	const fazendo = validStages.filter((s) => s.zone === "doing");
	const feito = validStages.filter((s) => s.zone === "done");

	return (
		<div>
			<h2 className="text-xl font-bold mb-1">Revise seu fluxo</h2>
			<p className="text-sm text-muted-foreground mb-6">
				Confira os estágios e zonas antes de começar.
			</p>

			{validStages.length === 0 && (
				<p className="text-sm text-muted-foreground">Nenhum estágio definido.</p>
			)}

			<div className="flex flex-col gap-4">
				{todas.length > 0 && (
					<div>
						<h3 className="text-sm font-semibold mb-2">📋 A fazer</h3>
						<div className="flex flex-wrap gap-2">
							{todas.map((s) => (
								<Badge key={s.id} variant="secondary">
									{s.name}
								</Badge>
							))}
						</div>
					</div>
				)}
				{fazendo.length > 0 && (
					<div>
						<h3 className="text-sm font-semibold mb-2">⚙️ Em andamento</h3>
						<div className="flex flex-wrap gap-2">
							{fazendo.map((s) => (
								<Badge key={s.id} variant="warning">
									{s.name}
								</Badge>
							))}
						</div>
					</div>
				)}
				{feito.length > 0 && (
					<div>
						<h3 className="text-sm font-semibold mb-2">✅ Feito</h3>
						<div className="flex flex-wrap gap-2">
							{feito.map((s) => (
								<Badge key={s.id} variant="success">
									{s.name}
								</Badge>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ── Wizard container ─────────────────────────────────────────
interface Props {
	onComplete: (stages: StageDef[]) => void;
	onBack: () => void;
}

export function PersonalizationWizard({ onComplete, onBack }: Props) {
	const [step, setStep] = useState(0);
	const [stages, setStages] = useState<StageDef[]>(defaultStages);

	const validStages = stages.filter((s) => s.name.trim().length > 0);
	const canContinue = [() => validStages.length > 0, () => true, () => true];

	const steps = [
		{ label: "Estágios", component: StepStages },
		{ label: "Zonas", component: StepZones },
		{ label: "Revisar", component: StepReview },
	];

	const StepComponent = steps[step].component;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-8">
			<div className="max-w-xl w-full">
				{/* Step indicator */}
				<div className="flex items-center gap-2 mb-8 justify-center">
					{steps.map((s, i) => (
						<div key={s.label} className="flex items-center gap-2">
							<span
								className={`text-xs px-2 py-1 rounded-full ${
									i === step
										? "bg-primary text-primary-foreground font-medium"
										: i < step
											? "bg-primary/20 text-primary"
											: "bg-muted text-muted-foreground"
								}`}
							>
								{s.label}
							</span>
							{i < steps.length - 1 && (
								<span
									className="w-6 h-px"
									style={{ background: "var(--border)" }}
								/>
							)}
						</div>
					))}
				</div>

				<StepComponent
					stages={stages}
					onChange={setStages}
				/>

				<div className="mt-8 flex justify-between">
					<Button
						variant="ghost"
						onClick={step === 0 ? onBack : () => setStep(step - 1)}
					>
						{step === 0 ? "Voltar" : "Anterior"}
					</Button>
					{step < steps.length - 1 ? (
						<Button
							disabled={!canContinue[step]()}
							onClick={() => setStep(step + 1)}
						>
							Próximo
						</Button>
					) : (
						<Button
							disabled={!canContinue[step]()}
							onClick={() => onComplete(validStages)}
						>
							Criar workflow
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
