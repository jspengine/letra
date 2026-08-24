import type {
	FlowDefinitionWarning,
	Item,
	ResolvedFlowDefinition,
	ResolvedFlowGate,
	ResolvedFlowRole,
	ResolvedFlowStage,
	Workflow,
} from "@letra/types";
import type { IconName } from "@letra/ui";

export type ActiveFlowGate = ResolvedFlowGate;
export type ActiveFlowStage = ResolvedFlowStage;
export type ActiveFlowDefinition = ResolvedFlowDefinition;
export type OperationalState = "idle" | "running" | "done" | "blocked" | "waiting";

export interface StagePresentation {
	actorLabel: string;
	actionLabel: string;
	icon: IconName;
	color: string;
	isHumanGate: boolean;
	isBlockingGate: boolean;
}

export interface PipelineStageProjection extends ActiveFlowStage {
	itemCount: number;
	status: OperationalState;
	presentation: StagePresentation;
}

export function orderedStages(
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): ActiveFlowStage[] {
	if (activeFlow?.stages?.length) return [...activeFlow.stages].sort((a, b) => a.order - b.order);
	return workflow.stages
		.map((stage) => ({
			id: stage.id,
			name: stage.name,
			order: stage.order,
			zone: stage.zone,
			description: undefined,
			roleIds: [],
			roles: [],
			agents: [],
			gate: null,
			provenance: "workflow-instance" as const,
		}))
		.sort((a, b) => a.order - b.order);
}

export function humanGateStageIds(
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): Set<string> {
	return new Set(
		orderedStages(workflow, activeFlow)
			.filter((stage) => stage.gate?.type === "human" && stage.gate.blocking)
			.map((stage) => stage.id),
	);
}

export function doneStageIds(
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): Set<string> {
	return new Set(
		orderedStages(workflow, activeFlow)
			.filter(
				(stage, index, list) =>
					stage.zone === "done" || (!stage.zone && index === list.length - 1),
			)
			.map((stage) => stage.id),
	);
}

export function nextStageId(
	stageId: string,
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): string | null {
	const stages = orderedStages(workflow, activeFlow);
	const index = stages.findIndex((stage) => stage.id === stageId);
	if (index < 0 || index >= stages.length - 1) return null;
	return stages[index + 1].id;
}

export function stageAgentLabel(
	stageId: string,
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): string {
	const stage = orderedStages(workflow, activeFlow).find((entry) => entry.id === stageId);
	if (!stage) return "Agent";
	if (stage.gate?.type === "human") return "Human";
	if (stage.roles[0]) return stage.roles[0].label;
	if (stage.roleIds[0]) return stage.roleIds[0];
	return stage.name;
}

export function stageActionLabel(stage: ActiveFlowStage): string {
	if (stage.gate?.type === "human") return `Aguardando ${stage.gate.name.toLowerCase()}`;
	if (stage.zone === "done") return "Concluído";
	if (stage.description) return stage.description;
	return `Processando em ${stage.name}`;
}

export function stageIcon(stage: ActiveFlowStage): IconName {
	if (stage.zone === "done") return "check";
	if (stage.gate?.type === "human") return "user";
	if (stage.gate) return "shield";
	if (stage.roles.length > 0 || stage.roleIds.length > 0) return "cpu";
	return "circle";
}

export function stagePresentation(stage: ActiveFlowStage): StagePresentation {
	const isHumanGate = stage.gate?.type === "human" && stage.gate.blocking;
	const isBlockingGate = Boolean(stage.gate?.blocking);
	const actorLabel = isHumanGate
		? "Human"
		: (stage.roles[0]?.label ?? stage.roleIds[0] ?? stage.name);
	return {
		actorLabel,
		actionLabel: stageActionLabel(stage),
		icon: stageIcon(stage),
		color:
			stage.zone === "done"
				? "var(--success)"
				: isHumanGate
					? "var(--gate-available)"
					: isBlockingGate
						? "var(--gate-blocked)"
						: "var(--primary)",
		isHumanGate,
		isBlockingGate,
	};
}

export function itemOperationalState(
	item: Item,
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): OperationalState {
	const stage = orderedStages(workflow, activeFlow).find((entry) => entry.id === item.stage);
	if (!stage) return item.claimedBy ? "running" : "idle";
	if (stage.zone === "done") return "done";
	if (stage.gate?.type === "human" && stage.gate.blocking) return "waiting";
	if (stage.gate?.blocking) return "blocked";
	if (item.claimedBy) return "running";
	return "idle";
}

export function pipelineProjection(
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): PipelineStageProjection[] {
	return orderedStages(workflow, activeFlow).map((stage) => {
		const items = workflow.items.filter((item) => item.stage === stage.id);
		const states = items.map((item) => itemOperationalState(item, workflow, activeFlow));
		const status: OperationalState = states.includes("waiting")
			? "waiting"
			: states.includes("blocked")
				? "blocked"
				: states.includes("running")
					? "running"
					: states.includes("done")
						? "done"
						: "idle";
		return {
			...stage,
			itemCount: items.length,
			status,
			presentation: stagePresentation(stage),
		};
	});
}

export function roleCatalog(activeFlow: ActiveFlowDefinition | null): ResolvedFlowRole[] {
	return (
		activeFlow?.roles.map((role) => ({
			...role,
			allowedStages: [...role.allowedStages],
			capabilities: [...role.capabilities],
		})) ?? []
	);
}

export function flowWarnings(activeFlow: ActiveFlowDefinition | null): FlowDefinitionWarning[] {
	return activeFlow?.warnings.map((warning) => ({ ...warning })) ?? [];
}
