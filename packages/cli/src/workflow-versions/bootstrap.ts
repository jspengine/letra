import type { ResolvedFlowStage } from "@letra/types";
import { loadWorkflow } from "../commands/flow-init.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import {
	createWorkflowDefinition,
	listWorkflowDefinitions,
	publishWorkflowDraft,
	type WorkflowDefinitionContent,
	type WorkflowVersion,
} from "./service.js";

/**
 * ITEM-35 (spec init-publica-workflow): a workspace created by `letra init
 * --workspace` gets version 1 of its workflow published from the template, so
 * activation pins items to it and a claim creates the Run. Without a published
 * version no Run is created and an agent cannot link a spec.
 */

/** Publishes the template version in an existing workspace (human operation). */
export const PUBLISH_INITIAL_VERSION_COMMAND = "letra flow workflow publish-initial";

type TemplateStage = ResolvedFlowStage & {
	final?: boolean;
	transitions?: Array<{ target: string }>;
	allow?: string[];
};

/**
 * Same shape the board editor publishes when it copies a template
 * (client `stagesFromTemplate`): harness templates move by stage order and mark
 * the end with `zone: "done"`; versioned workflows need explicit transitions,
 * a final stage and `allow` for the roles that act.
 */
export function versionedStagesFromTemplate(source: readonly ResolvedFlowStage[]): TemplateStage[] {
	const ordered = [...source].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) as TemplateStage[];
	return ordered.map((stage, order) => {
		const copy: TemplateStage = { ...structuredClone(stage), order };
		const final = copy.final ?? copy.zone === "done";
		if (final) copy.final = true;
		const next = ordered[order + 1];
		if (!final && !copy.transitions?.length && next) copy.transitions = [{ target: next.id }];
		if (!copy.allow?.length && copy.roleIds?.length) copy.allow = [...copy.roleIds];
		return copy;
	});
}

export type InitialVersionResult =
	| { status: "published"; version: WorkflowVersion }
	| { status: "skipped"; reason: "already-versioned" | "no-template" | "template-unavailable" };

/**
 * Publishes version 1 from the workspace template when the workspace has no
 * workflow definition yet. Existing definitions are never touched.
 */
export function publishInitialWorkflowVersion(root: string, actor: string): InitialVersionResult {
	if (listWorkflowDefinitions(root).length > 0) return { status: "skipped", reason: "already-versioned" };
	const workflow = loadWorkflow(root);
	if (!workflow?.template) return { status: "skipped", reason: "no-template" };
	const flow = resolveActiveFlow(root).flow;
	if (!flow || flow.source !== "workflow-template" || flow.stages.length === 0)
		return { status: "skipped", reason: "template-unavailable" };
	const stages = versionedStagesFromTemplate(flow.stages);
	const content: WorkflowDefinitionContent = {
		name: workflow.name || flow.name,
		template: workflow.template,
		initialStageId: stages[0]?.id,
		// Resolved stages are plain data; the content schema indexes them by key.
		stages: stages as unknown as WorkflowDefinitionContent["stages"],
	};
	const { definition, draft } = createWorkflowDefinition(root, { name: content.name, actor, content });
	const version = publishWorkflowDraft(root, definition.id, {
		expectedRevision: draft.revision,
		actor,
		reason: `Versão inicial publicada pelo letra init a partir do template ${workflow.template}.`,
	});
	return { status: "published", version };
}
