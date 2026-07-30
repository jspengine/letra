import { loadWorkflow } from "../commands/flow-init.js";
import type { Stage, Workflow } from "../commands/flow-init.js";
import { DEFAULT_HARNESS_VERSION, loadHarness, resolveHarnessRoot } from "../harness/loader.js";
import type {
	ActivityHintConfig,
	FlowTemplate,
	HarnessManifest,
	StageActivityContextConfig,
	StageDef,
	StagePhases,
} from "../harness/types.js";
import type {
	ActiveFlowResolution,
	FlowDefinitionWarning,
	ResolvedFlowDefinition,
	ResolvedFlowGate,
	ResolvedFlowRole,
	ResolvedFlowStage,
	ResolvedStagePhases,
} from "./types.js";

function resolveTemplate(
	workflow: Workflow | null,
	harness: HarnessManifest | null,
): FlowTemplate | null {
	if (!workflow?.template || !harness) return null;
	return harness.flows[workflow.template] ?? null;
}

function gateIdFromRef(gateRef: string): string {
	return gateRef.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");
}

function cloneActivityHint<T extends ActivityHintConfig>(hint: T | undefined): T | undefined {
	if (!hint) return undefined;
	return {
		...hint,
		mustRead: hint.mustRead?.map((reference) => ({ ...reference })),
		mustNotDo: hint.mustNotDo ? [...hint.mustNotDo] : undefined,
		nextActions: hint.nextActions?.map((action) => ({ ...action })),
		commands: hint.commands?.map((command) => ({ ...command })),
	};
}

function cloneActivity(
	activity: StageActivityContextConfig | undefined,
): StageActivityContextConfig | undefined {
	if (!activity) return undefined;
	return {
		design: cloneActivityHint(activity.design),
		implement: cloneActivityHint(activity.implement),
		review: cloneActivityHint(activity.review),
		diagnose: cloneActivityHint(activity.diagnose),
		gate: cloneActivityHint(activity.gate),
	};
}

function resolveGate(
	harness: HarnessManifest | null,
	gateRef: string | null | undefined,
	warnings: FlowDefinitionWarning[],
	artifactRef: string,
): ResolvedFlowGate | null {
	if (!harness || !gateRef) return null;
	const gateId = gateIdFromRef(gateRef);
	const gate = harness.gates[gateId];
	if (!gate) {
		warnings.push({
			code: "GATE_NOT_FOUND",
			message: `Gate "${gateId}" referenced by ${artifactRef} was not found in the harness.`,
			artifactRef,
		});
		return null;
	}
	return {
		id: gate.id,
		name: gate.name,
		type: gate.type,
		blocking: gate.blocking,
		policyRef: gate.policyRef,
		description: gate.description,
		decisions: gate.decisions ? { ...gate.decisions } : undefined,
	};
}

function cloneRole(role: HarnessManifest["roles"][string]): ResolvedFlowRole {
	return {
		id: role.id,
		label: role.label,
		description: role.description,
		allowedStages: [...role.allowedStages],
		capabilities: [...role.capabilities],
	};
}

function resolveRoles(
	harness: HarnessManifest | null,
	roleIds: string[],
	warnings: FlowDefinitionWarning[],
	artifactRef: string,
): ResolvedFlowRole[] {
	if (!harness) return [];
	return roleIds.flatMap((roleId) => {
		const role = harness.roles[roleId];
		if (role) return [cloneRole(role)];
		warnings.push({
			code: "ROLE_NOT_FOUND",
			message: `Role "${roleId}" referenced by ${artifactRef} was not found in the harness.`,
			artifactRef,
		});
		return [];
	});
}

function resolvePhases(
	harness: HarnessManifest | null,
	phases: StagePhases | undefined,
	warnings: FlowDefinitionWarning[],
	stageId: string,
): ResolvedStagePhases | undefined {
	if (!phases) return undefined;
	return {
		initialState: phases.initialState,
		states: Object.fromEntries(
			Object.entries(phases.states).map(([phaseId, phase]) => [
				phaseId,
				{
					id: phase.id,
					label: phase.label,
					description: phase.description,
					actions: phase.actions?.map((action) => ({ ...action })),
					transitions: phase.transitions?.map((transition) => ({
						target: transition.target,
						gate: resolveGate(
							harness,
							transition.gate,
							warnings,
							`flow stage "${stageId}" phase "${phaseId}" transition to "${transition.target}"`,
						),
						...(transition.gate ? { gateRef: transition.gate } : {}),
						...(transition.auto === undefined ? {} : { auto: transition.auto }),
					})),
					harness: phase.harness
						? {
								...phase.harness,
								tools: phase.harness.tools ? [...phase.harness.tools] : undefined,
								checks: phase.harness.checks
									? [...phase.harness.checks]
									: undefined,
								activity: cloneActivity(phase.harness.activity),
								review: cloneActivityHint(phase.harness.review),
								gate: cloneActivityHint(phase.harness.gate),
							}
						: undefined,
				},
			]),
		),
	};
}

function mergeTemplateStage(
	workflow: Workflow,
	harness: HarnessManifest | null,
	stageDef: StageDef,
	index: number,
	warnings: FlowDefinitionWarning[],
): ResolvedFlowStage {
	const workflowStage = workflow.stages.find((stage) => stage.id === stageDef.id);
	const artifactRef = `flow stage "${stageDef.id}"`;
	const roleIds = [...(stageDef.agents ?? [])];
	return {
		id: stageDef.id,
		name: stageDef.name || workflowStage?.name || stageDef.id,
		order: stageDef.order ?? workflowStage?.order ?? index,
		zone: stageDef.zone ?? workflowStage?.zone,
		description: stageDef.description,
		roleIds,
		roles: resolveRoles(harness, roleIds, warnings, artifactRef),
		agents: [...roleIds],
		gate: resolveGate(harness, stageDef.gate, warnings, artifactRef),
		phases: resolvePhases(harness, stageDef.phases, warnings, stageDef.id),
		activity: cloneActivity(stageDef.activity),
		provenance: "harness",
	};
}

function workflowStageDefinition(
	stage: Stage,
	provenance: "workflow-instance" = "workflow-instance",
): ResolvedFlowStage {
	return {
		id: stage.id,
		name: stage.name,
		order: stage.order,
		zone: stage.zone,
		description: undefined,
		roleIds: [],
		roles: [],
		agents: [],
		gate: null,
		phases: resolvePhases(null, stage.phases, [], stage.id),
		activity: undefined,
		provenance,
	};
}

function resolveFromTemplate(
	workflow: Workflow,
	harness: HarnessManifest | null,
	template: FlowTemplate,
): ResolvedFlowDefinition {
	const warnings: FlowDefinitionWarning[] = [];
	const instanceStageIds = new Set(workflow.stages.map((stage) => stage.id));
	const templateStageIds = new Set(template.stages.map((stage) => stage.id));
	const templateStages = template.stages.map((stageDef, index) => {
		if (!instanceStageIds.has(stageDef.id)) {
			warnings.push({
				code: "TEMPLATE_STAGE_NOT_IN_INSTANCE",
				message: `Harness stage "${stageDef.id}" is not persisted in the workflow instance.`,
				artifactRef: `flow stage "${stageDef.id}"`,
			});
		}
		return mergeTemplateStage(workflow, harness, stageDef, index, warnings);
	});
	const extensionStages = workflow.stages
		.filter((stage) => !templateStageIds.has(stage.id))
		.map((stage) => {
			warnings.push({
				code: "INSTANCE_STAGE_NOT_IN_TEMPLATE",
				message: `Workflow stage "${stage.id}" is not declared by template "${template.id}".`,
				artifactRef: `workflow stage "${stage.id}"`,
			});
			return workflowStageDefinition(stage);
		});
	return {
		id: template.id,
		source: "workflow-template",
		harnessVersion: workflow.harnessVersion ?? DEFAULT_HARNESS_VERSION,
		templateVersion: template.version,
		name: template.name,
		stages: [...templateStages, ...extensionStages].sort(
			(left, right) => left.order - right.order,
		),
		roles: harness ? Object.values(harness.roles).map(cloneRole) : [],
		warnings,
	};
}

function resolveFromWorkflow(
	workflow: Workflow,
	source: "workflow-instance" | "legacy-fallback",
	warnings: FlowDefinitionWarning[] = [],
): ResolvedFlowDefinition {
	return {
		id: workflow.template ?? null,
		source,
		harnessVersion: workflow.harnessVersion ?? null,
		templateVersion: null,
		name: workflow.name,
		stages: workflow.stages
			.map((stage) => workflowStageDefinition(stage as Stage))
			.sort((left, right) => left.order - right.order),
		roles: [],
		warnings: warnings.map((warning) => ({ ...warning })),
	};
}

export function resolveActiveFlowFrom(
	workflow: Workflow | null,
	harness: HarnessManifest | null,
): ActiveFlowResolution {
	const template = resolveTemplate(workflow, harness);
	if (!workflow) {
		return { workflow, harness, template: null, flow: null };
	}
	if (template) {
		return {
			workflow,
			harness,
			template,
			flow: resolveFromTemplate(workflow, harness, template),
		};
	}
	if (workflow.template) {
		const warnings: FlowDefinitionWarning[] = harness
			? [
					{
						code: "TEMPLATE_NOT_FOUND",
						message: `Template "${workflow.template}" was not found in harness "${workflow.harnessVersion ?? DEFAULT_HARNESS_VERSION}".`,
						artifactRef: `harness flow "${workflow.template}"`,
					},
				]
			: [
					{
						code: "HARNESS_UNAVAILABLE",
						message: `Harness "${workflow.harnessVersion ?? DEFAULT_HARNESS_VERSION}" is unavailable for template "${workflow.template}".`,
						artifactRef: `harness "${workflow.harnessVersion ?? DEFAULT_HARNESS_VERSION}"`,
					},
				];
		return {
			workflow,
			harness,
			template: null,
			flow: resolveFromWorkflow(workflow, "legacy-fallback", warnings),
		};
	}
	return {
		workflow,
		harness,
		template: null,
		flow: resolveFromWorkflow(workflow, "workflow-instance"),
	};
}

export function resolveActiveFlow(root: string): ActiveFlowResolution {
	return resolveActiveFlowFor(root);
}

export function resolveActiveFlowFor(
	root: string,
	workflow: Workflow | null = loadWorkflow(root),
): ActiveFlowResolution {
	const harness = loadHarnessForWorkflow(root, workflow);
	return resolveActiveFlowFrom(workflow, harness);
}

export function loadHarnessForWorkflow(
	root: string,
	workflow: Workflow | null,
): HarnessManifest | null {
	const version = workflow?.harnessVersion ?? DEFAULT_HARNESS_VERSION;
	return loadHarness(resolveHarnessRoot(root, version));
}
