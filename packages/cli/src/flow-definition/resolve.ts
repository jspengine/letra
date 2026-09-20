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
import {
	getActiveWorkflowVersion,
	getWorkflowVersion,
	listWorkflowDefinitions,
	listWorkflowVersions,
	type WorkflowVersion,
} from "../workflow-versions/service.js";

export interface ResolveActiveFlowOptions {
	workflowVersionId?: string | null;
	itemId?: string | null;
	workflowId?: string | null;
}

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
		preCheck: gate.pre_check,
		checkType: gate.check_type,
	};
}

function resolveOperations(template: FlowTemplate): ResolvedFlowDefinition["operations"] {
	return Object.fromEntries(Object.entries(template.operations ?? {}).map(([id, operation]) => [id, {
		requiredCapability: operation.required_capability,
		requiresClaim: operation.requires_claim,
		allowedInStages: [...(operation.allowed_in_stages ?? [])],
		allowedActors: [...(operation.allowed_actors ?? [])],
		actorPrefix: operation.actor_prefix,
		description: operation.description,
	}]));
}

function validateHookOperations(
	template: FlowTemplate,
	stageId: string,
	warnings: FlowDefinitionWarning[],
): void {
	const declaredOperations = Object.keys(template.operations ?? {});
	const hooks = template.stages.find((s) => s.id === stageId)?.hooks;
	if (!hooks) return;
	for (const hook of hooks.on_enter ?? []) {
		if (!declaredOperations.includes(hook.action)) {
			warnings.push({
				code: "HOOK_OPERATION_NOT_DECLARED",
				message: `Hook action "${hook.action}" referenced by stage "${stageId}" is not declared in the flow operations registry.`,
				artifactRef: `flow stage "${stageId}" hook on_enter`,
			});
		}
	}
	for (const hook of hooks.on_exit ?? []) {
		if (!declaredOperations.includes(hook.action)) {
			warnings.push({
				code: "HOOK_OPERATION_NOT_DECLARED",
				message: `Hook action "${hook.action}" referenced by stage "${stageId}" is not declared in the flow operations registry.`,
				artifactRef: `flow stage "${stageId}" hook on_exit`,
			});
		}
	}
}

function validateReworkOperation(
	template: FlowTemplate,
	stageId: string,
	warnings: FlowDefinitionWarning[],
): void {
	const declaredOperations = Object.keys(template.operations ?? {});
	const rework = template.stages.find((s) => s.id === stageId)?.rework;
	if (!rework?.action) return;
	if (!declaredOperations.includes(rework.action)) {
		warnings.push({
			code: "REWORK_OPERATION_NOT_DECLARED",
			message: `Rework action "${rework.action}" referenced by stage "${stageId}" is not declared in the flow operations registry.`,
			artifactRef: `flow stage "${stageId}" rework`,
		});
	}
}

function validateAutoTransitionGates(
	template: FlowTemplate,
	stageId: string,
	warnings: FlowDefinitionWarning[],
): void {
	const declaredGates = Object.keys(template.stages.flatMap((s) => {
		// Collect all gate IDs referenced anywhere in the template
		const gates: string[] = [];
		if (s.gate) gates.push(s.gate);
		for (const state of Object.values(s.phases?.states ?? {})) {
			for (const t of state.transitions ?? []) {
				if (t.gate) gates.push(t.gate);
			}
		}
		return gates;
	}));
	// Also add gates from the harness gates registry
	// (auto_transitions can reference any gate in the harness, not just flow-level)
	const stage = template.stages.find((s) => s.id === stageId);
	if (!stage?.auto_transitions) return;
	for (const at of stage.auto_transitions) {
		if (!at.gate) continue;
		// Check if gate exists in template's stages or harness gates
		const gateInStages = stage.gate === at.gate;
		const gateInOtherStages = template.stages.some((s) => {
			if (s.gate === at.gate) return true;
			return Object.values(s.phases?.states ?? {}).some((state) =>
				state.transitions?.some((t) => t.gate === at.gate),
			);
		});
		if (!gateInStages && !gateInOtherStages) {
			warnings.push({
				code: "AUTO_TRANSITION_GATE_NOT_DECLARED",
				message: `Auto-transition gate "${at.gate}" referenced by stage "${stageId}" is not declared in the flow or harness gate registry.`,
				artifactRef: `flow stage "${stageId}" auto_transition`,
			});
		}
	}
}

function resolveHooks(stageDef: StageDef): ResolvedFlowStage["hooks"] {
	if (!stageDef.hooks) return undefined;
	const normalize = (hooks: NonNullable<StageDef["hooks"]>["on_enter"] = []) => hooks.map((hook) => ({
		action: hook.action,
		auto: hook.auto === true,
		requiresClaim: hook.requires_claim === true,
		params: hook.params ? { ...hook.params } : undefined,
	}));
	return { on_enter: normalize(stageDef.hooks.on_enter), on_exit: normalize(stageDef.hooks.on_exit) };
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
	template: FlowTemplate,
	workflow: Workflow,
	harness: HarnessManifest | null,
	stageDef: StageDef,
	index: number,
	warnings: FlowDefinitionWarning[],
): ResolvedFlowStage {
	const workflowStage = workflow.stages.find((stage) => stage.id === stageDef.id);
	const artifactRef = `flow stage "${stageDef.id}"`;
	const roleIds = [...(stageDef.agents ?? [])];
	// AC7: validate registry references before resolving
	validateHookOperations(template, stageDef.id, warnings);
	validateReworkOperation(template, stageDef.id, warnings);
	validateAutoTransitionGates(template, stageDef.id, warnings);
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
		preferredExecutor: stageDef.preferredExecutor,
		phases: resolvePhases(harness, stageDef.phases, warnings, stageDef.id),
		activity: cloneActivity(stageDef.activity),
		provenance: "harness",
		rework: stageDef.rework,
		hooks: resolveHooks(stageDef),
		auto_transitions: stageDef.auto_transitions,
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
		preferredExecutor: undefined,
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
		return mergeTemplateStage(template, workflow, harness, stageDef, index, warnings);
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
		operations: resolveOperations(template),
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
		stages: (Array.isArray(workflow.stages) ? workflow.stages : [])
			.map((stage) => workflowStageDefinition(stage as Stage))
			.sort((left, right) => left.order - right.order),
		roles: [],
		operations: {},
		warnings: warnings.map((warning) => ({ ...warning })),
	};
}

function resolveVersionTarget(
	root: string,
	workflow: Workflow | null,
	options?: ResolveActiveFlowOptions,
): WorkflowVersion | null {
	if (options?.workflowVersionId) {
		const definitions = listWorkflowDefinitions(root);
		for (const def of definitions) {
			const versions = listWorkflowVersions(root, def.id);
			const match = versions.find((v) => v.id === options.workflowVersionId);
			if (match) return match;
		}
	}

	if (options?.itemId && workflow?.items) {
		const item = workflow.items.find((candidate) => candidate.id === options.itemId);
		if (item?.workflowVersionId) {
			const definitions = listWorkflowDefinitions(root);
			for (const def of definitions) {
				const versions = listWorkflowVersions(root, def.id);
				const match = versions.find((v) => v.id === item.workflowVersionId);
				if (match) return match;
			}
		}
	}

	if (workflow?.primaryItemId && workflow.items) {
		const primary = workflow.items.find((candidate) => candidate.id === workflow.primaryItemId);
		if (primary?.workflowVersionId) {
			const definitions = listWorkflowDefinitions(root);
			for (const def of definitions) {
				const versions = listWorkflowVersions(root, def.id);
				const match = versions.find((v) => v.id === primary.workflowVersionId);
				if (match) return match;
			}
		}
	}

	const definitions = listWorkflowDefinitions(root);
	if (definitions.length === 0) return null;

	const targetDef =
		(options?.workflowId ? definitions.find((d) => d.id === options.workflowId) : null) ??
		definitions.find((d) => d.activeVersionId !== null) ??
		definitions[0];

	if (!targetDef?.activeVersionId) return null;

	return getActiveWorkflowVersion(root, targetDef.id);
}

function resolveFromWorkflowVersion(
	version: WorkflowVersion,
	workflow: Workflow | null,
	harness: HarnessManifest | null,
): ActiveFlowResolution {
	const warnings: FlowDefinitionWarning[] = [];
	const content = version.content;
	const stagesDef = Array.isArray(content?.stages) ? content.stages : [];

	const stages: ResolvedFlowStage[] = stagesDef
		.map((rawStage, index) => {
			const stageDef = rawStage as Record<string, any>;
			const zone = stageDef.zone ?? (stageDef.final ? "done" : index === 0 ? "todo" : "doing");
			const roleIds = Array.isArray(stageDef.allow) ? (stageDef.allow as string[]) : [];
			const artifactRef = `version stage "${stageDef.id}"`;
			const gate = stageDef.gate
				? resolveGate(
						harness,
						typeof stageDef.gate === "string" ? stageDef.gate : stageDef.gate.id,
						warnings,
						artifactRef,
				  )
				: null;

			return {
				id: stageDef.id,
				name: stageDef.name ?? (stageDef.id.charAt(0).toUpperCase() + stageDef.id.slice(1)),
				order: typeof stageDef.order === "number" ? stageDef.order : index,
				zone,
				description: stageDef.description,
				roleIds,
				roles: resolveRoles(harness, roleIds, warnings, artifactRef),
				agents: roleIds,
				gate,
				preferredExecutor: stageDef.preferredExecutor as string | undefined,
				phases: stageDef.phases as ResolvedStagePhases | undefined,
				activity: stageDef.activity as ResolvedFlowStage["activity"],
				provenance: "workflow-version" as const,
				rework: stageDef.rework as ResolvedFlowStage["rework"],
				hooks: stageDef.hooks as ResolvedFlowStage["hooks"],
				auto_transitions: stageDef.auto_transitions as ResolvedFlowStage["auto_transitions"],
			};
		})
		.sort((a, b) => a.order - b.order);

	const adaptedWorkflow: Workflow = {
		version: version.number ? `v${version.number}` : (workflow?.version ?? "1.0"),
		name: content.name ?? (workflow?.name ?? "Workflow"),
		description: content.description ?? workflow?.description,
		createdAt: version.createdAt ?? (workflow?.createdAt ?? new Date().toISOString()),
		updatedAt: version.publishedAt ?? (workflow?.updatedAt ?? new Date().toISOString()),
		stages: stagesDef.map((rawStage, index) => {
			const stageDef = rawStage as Record<string, any>;
			const resolved = stages.find((s) => s.id === stageDef.id);
			return {
				id: stageDef.id,
				name: resolved?.name ?? stageDef.name ?? stageDef.id,
				order: resolved?.order ?? (typeof stageDef.order === "number" ? stageDef.order : index),
				zone: resolved?.zone,
				phases: stageDef.phases as StagePhases | undefined,
				allow: resolved?.roleIds,
				gate: resolved?.gate?.id ?? (typeof stageDef.gate === "string" ? stageDef.gate : stageDef.gate?.id) ?? null,
			};
		}),
		items: workflow?.items ?? [],
		tools: workflow?.tools ?? [],
		webhooks: workflow?.webhooks,
		primaryItemId: workflow?.primaryItemId,
		state: workflow?.state,
		template: version.workflowId,
		harnessVersion:
			(content.harnessVersion as string) ?? (workflow?.harnessVersion ?? DEFAULT_HARNESS_VERSION),
	};

	const flow: ResolvedFlowDefinition = {
		id: version.workflowId,
		source: "workflow-version",
		harnessVersion: adaptedWorkflow.harnessVersion ?? null,
		templateVersion: version.number ? `v${version.number}` : null,
		name: content.name ?? "Workflow",
		stages,
		roles: harness ? Object.values(harness.roles).map(cloneRole) : [],
		operations: (content.operations as ResolvedFlowDefinition["operations"]) ?? {},
		warnings,
		workflowVersionId: version.id,
		workflowVersionNumber: version.number,
		contentHash: version.contentHash,
	};

	return {
		workflow: adaptedWorkflow,
		harness,
		template: null,
		flow,
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

export function resolveActiveFlow(
	root: string,
	options?: ResolveActiveFlowOptions,
): ActiveFlowResolution {
	return resolveActiveFlowFor(root, undefined, options);
}

export function resolveActiveFlowFor(
	root: string,
	workflow: Workflow | null = loadWorkflow(root),
	options?: ResolveActiveFlowOptions,
): ActiveFlowResolution {
	const harness = loadHarnessForWorkflow(root, workflow);
	try {
		const versionTarget = resolveVersionTarget(root, workflow, options);
		if (versionTarget) {
			return resolveFromWorkflowVersion(versionTarget, workflow, harness);
		}
	} catch {
		// Fallback to workflow/harness
	}
	return resolveActiveFlowFrom(workflow, harness);
}

export function loadHarnessForWorkflow(
	root: string,
	workflow: Workflow | null,
): HarnessManifest | null {
	const version = workflow?.harnessVersion ?? DEFAULT_HARNESS_VERSION;
	return loadHarness(resolveHarnessRoot(root, version));
}
