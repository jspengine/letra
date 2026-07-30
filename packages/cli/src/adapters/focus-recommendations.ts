import type { Workflow } from "../commands/flow-init.js";
import { resolveActiveFlowFor } from "../flow-definition/resolve.js";
import type { ResolvedFlowDefinition } from "../flow-definition/types.js";
import { writeFocusFile, type FocusRecommendedAction } from "./focus-sync.js";

const ACTIVITY_ORDER = ["design", "implement", "review", "diagnose", "gate"] as const;

export function collectFocusRecommendations(
	workflow: Workflow,
	flow: ResolvedFlowDefinition | null,
	itemId: string,
): FocusRecommendedAction[] {
	const item = workflow.items.find((candidate) => candidate.id === itemId);
	if (!item || !flow) return [];
	const stage = flow.stages.find((candidate) => candidate.id === item.stage);
	if (!stage?.activity) return [];

	const sortedStages = [...flow.stages].sort((left, right) => left.order - right.order);
	const stageIndex = sortedStages.findIndex((candidate) => candidate.id === stage.id);
	const nextStageId = stageIndex >= 0 ? sortedStages[stageIndex + 1]?.id : undefined;
	const seen = new Set<string>();
	const recommendations: FocusRecommendedAction[] = [];

	for (const kind of ACTIVITY_ORDER) {
		for (const hint of stage.activity[kind]?.commands ?? []) {
			const command = hint.command
				.replaceAll("<ITEM-ID>", item.id)
				.replaceAll("<NEXT-STAGE>", nextStageId ?? "<NEXT-STAGE>");
			if (seen.has(command)) continue;
			seen.add(command);
			recommendations.push({
				command,
				label: hint.label,
				description: hint.description,
			});
		}
	}
	return recommendations;
}

export function resolveFocusRecommendations(
	root: string,
	itemId: string,
): FocusRecommendedAction[] {
	const resolution = resolveActiveFlowFor(root);
	if (!resolution.workflow) return [];
	return collectFocusRecommendations(resolution.workflow, resolution.flow, itemId);
}

export function writeFocusWithRecommendations(
	root: string,
	specName: string,
	itemId: string,
): void {
	writeFocusFile(root, specName, itemId, resolveFocusRecommendations(root, itemId));
}
