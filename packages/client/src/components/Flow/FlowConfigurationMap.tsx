import { Card, CardContent, Icon, Tag } from "@letra/ui";
import type { ActiveFlowDefinition, ActiveFlowStage } from "../../lib/active-flow";
import type { Item } from "@letra/types";

interface Props {
	stages: ActiveFlowStage[];
	activeFlow: ActiveFlowDefinition | null;
	items?: Item[];
}

function stageActor(stage: ActiveFlowStage): string {
	if (stage.gate?.type === "human") return "Humano";
	return stage.roles[0]?.label ?? stage.roleIds[0] ?? "Sem papel";
}

function stageTransitions(stage: ActiveFlowStage): string[] {
	const transitions = Object.values(stage.phases?.states ?? {}).flatMap((phase) =>
		(phase.transitions ?? []).map((transition) => `${phase.label} → ${transition.target}`),
	);
	return [...new Set(transitions)];
}

export default function FlowConfigurationMap({ stages, activeFlow, items = [] }: Props) {
	return (
		<Card className="shrink-0">
			<CardContent className="p-3 sm:p-4">
				<div className="flex items-start justify-between gap-3 mb-3">
					<div>
						<div className="flex items-center gap-2">
							<Icon name="git-branch" size={16} style={{ color: "var(--color-primary)" }} />
							<h2 className="text-sm font-semibold">Configuração da esteira</h2>
						</div>
				<p className="app-section-muted text-caption mt-1">
					{activeFlow?.name ?? "Fluxo legado"} · {activeFlow ? `fonte: ${activeFlow.source}` : "fonte: instância do workflow"}
				</p>
					</div>
					{activeFlow?.harnessVersion ? <Tag>harness {activeFlow.harnessVersion}</Tag> : null}
				</div>
				<div className="flex min-w-0 items-stretch gap-2 overflow-x-auto pb-1">
					{stages.map((stage, index) => {
						const role = stage.roles[0];
						const configuredGate = stage.gate;
						const expectedGate = stage.activity?.gate;
						const isHuman = configuredGate?.type === "human" && configuredGate.blocking;
						const hasHumanApproval = isHuman || Boolean(expectedGate);
						const itemsInStage = items?.filter((item) => item.stage === stage.id).length ?? 0;
						const explicitTransitions = stageTransitions(stage);
						const nextStage = stages[index + 1];
						return (
						<div key={stage.id} className="flex min-w-[230px] items-center gap-2">
								<div
									className="min-w-0 flex-1 rounded-[var(--radius-sm)] border p-3"
									style={{
										borderColor: isHuman ? "var(--color-warning)" : "var(--color-border)",
										background: isHuman ? "color-mix(in oklch, var(--color-warning) 8%, transparent)" : "var(--color-bg-surface)",
									}}
								>
									<div className="flex items-center gap-2">
										<Icon name={isHuman ? "user" : stage.zone === "done" ? "check" : "cpu"} size={14} style={{ color: isHuman ? "var(--color-warning)" : "var(--color-primary)" }} />
										<span className="truncate text-sm font-semibold">{stage.name}</span>
									</div>
									<div className="mt-2 grid gap-1 text-caption" style={{ color: "var(--color-text-secondary)" }}>
										<div><strong className="font-medium text-[var(--color-text-primary)]">Atua:</strong> {stageActor(stage)}</div>
										{role?.description ? <div className="line-clamp-2">{role.description}</div> : null}
									</div>
									{role?.capabilities?.length ? (
										<div className="mt-2 flex flex-wrap gap-1">
											{role.capabilities.map((capability) => <Tag key={capability}>{capability}</Tag>)}
										</div>
									) : null}
									<div className="mt-2 text-caption" style={{ color: "var(--color-text-secondary)" }}>
										Executor: {stage.preferredExecutor ?? "fallback do registro"}
									</div>
									{stage.phases ? (
										<div className="mt-2 text-caption" style={{ color: "var(--color-text-secondary)" }}>
											Fases: {Object.values(stage.phases.states).map((phase) => phase.label).join(" · ")}
										</div>
									) : null}
									{explicitTransitions.length > 0 ? (
										<div className="mt-1 text-caption" style={{ color: "var(--color-text-secondary)" }}>
											<span className="font-medium text-[var(--color-text-primary)]">Transições: {explicitTransitions.join(" · ")}</span>
										</div>
									) : nextStage ? (
										<div className="mt-1 text-caption" style={{ color: "var(--color-text-secondary)" }}>
											<strong className="font-medium text-[var(--color-text-primary)]">Transição:</strong> concluir critérios e validação → {nextStage.name}
										</div>
									) : null}
									{configuredGate ? <div className="mt-2 text-caption font-medium" style={{ color: isHuman ? "var(--color-warning)" : "var(--color-text-secondary)" }}>{isHuman ? "Gate humano" : "Gate automático"}: {configuredGate.name}</div> : null}
									{expectedGate ? (
										<div className="mt-2 grid gap-1 rounded border px-2 py-1.5 text-caption" style={{ borderColor: "var(--color-warning)", color: "var(--color-warning)", background: "color-mix(in oklch, var(--color-warning) 8%, transparent)" }}>
											<div className="font-semibold">Aprovação humana: {expectedGate.label ?? "necessária"}</div>
											{expectedGate.decision ? <div>Decisão: {expectedGate.decision}</div> : null}
											{expectedGate.evidence ? <div>Evidências: {expectedGate.evidence}</div> : null}
											{itemsInStage > 0 ? <div className="font-semibold">{itemsInStage} item(ns) aguardam este gate</div> : <div>Nenhum item aguardando agora</div>}
										</div>
									) : hasHumanApproval && itemsInStage > 0 ? <div className="mt-2 text-caption font-medium" style={{ color: "var(--color-warning)" }}>Aprovação pendente para {itemsInStage} item(ns)</div> : null}
								</div>
								{index < stages.length - 1 ? <Icon name="chevron-right" size={14} className="shrink-0" style={{ color: "var(--color-text-secondary)" }} /> : null}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
