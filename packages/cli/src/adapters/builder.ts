import { existsSync } from "node:fs";
import { join } from "node:path";
import { countACs } from "./ac-counter.js";
import { readFocusFile } from "./focus-sync.js";
import type { GenerateOptions, HarnessItem, HarnessSnapshot } from "./types.js";

export function buildHarnessSnapshot(root: string, options: GenerateOptions): HarnessSnapshot {
	const hasFocus = existsSync(join(root, ".letra", "focus.md"));

	if (!options.workflow || !options.activeStageId) {
		return {
			workflowName: "letra",
			hasWorkflow: false,
			items: [],
			hasFocus,
			primaryItemId: null,
			focusSpec: null,
			focusPath: null,
		};
	}

	const { workflow, activeStageId } = options;
	const stage = workflow.stages.find((s) => s.id === activeStageId);
	const stageItems = workflow.items.filter((item) => item.stage === activeStageId);

	// Determinar primaryItemId
	let primaryItemId: string | null = null;
	if (options.primaryItemId && stageItems.some((i) => i.id === options.primaryItemId)) {
		primaryItemId = options.primaryItemId;
	} else if (stageItems.length > 0) {
		primaryItemId = stageItems[0].id;
	}

	const acDrifts: Array<{ spec: string; specCount: number; acceptanceCount: number }> = [];

	const items: HarnessItem[] = stageItems.map((item) => {
		const harnessItem: HarnessItem = {
			id: item.id,
			description: item.description,
			spec: item.spec,
		};

		if (item.spec) {
			harnessItem.specPath = `.letra/specs/${item.spec}/spec.md`;
			harnessItem.acceptancePath = `.letra/specs/${item.spec}/acceptance.md`;

			const specDir = join(root, ".letra", "specs", item.spec);
			const acCount = countACs(specDir);
			harnessItem.acPending = acCount.pending;
			harnessItem.acTotal = acCount.total;

			if (acCount.drift) {
				acDrifts.push({
					spec: item.spec,
					specCount: acCount.specCount,
					acceptanceCount: acCount.acceptanceCount,
				});
			}
		}

		if (item.tasks) {
			harnessItem.tasksTotal = item.tasks.length;
			harnessItem.tasksOpen = item.tasks.filter((t) => !t.done).length;
		} else {
			harnessItem.tasksTotal = 0;
			harnessItem.tasksOpen = 0;
		}

		return harnessItem;
	});

	// Determinar focusSpec e focusPath
	let focusSpec: string | null = null;
	let focusPath: string | null = null;

	const parsedFocus = readFocusFile(root);
	if (parsedFocus) {
		focusSpec = parsedFocus.specName;
		focusPath = `.letra/specs/${parsedFocus.specName}/`;
	} else {
		// Derivar do item primário se ele tiver spec
		const primaryItem = items.find((i) => i.id === primaryItemId);
		if (primaryItem && primaryItem.spec) {
			focusSpec = primaryItem.spec;
			focusPath = `.letra/specs/${primaryItem.spec}/`;
		}
	}

	return {
		workflowName: workflow.name,
		hasWorkflow: true,
		activeStage: stage
			? { id: stage.id, name: stage.name }
			: { id: activeStageId, name: activeStageId },
		items,
		hasFocus,
		primaryItemId,
		focusSpec,
		focusPath,
		acDrifts: acDrifts.length > 0 ? acDrifts : undefined,
	};
}
