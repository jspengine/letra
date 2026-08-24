import { loadWorkflow } from "../commands/flow-init.js";
import { buildHarnessSnapshot } from "./builder.js";
import { formatAdapterContent } from "./formatters.js";

export type HermesOptions = {
	root: string;
	source?: string;
	displayName?: string;
};

export function buildHermesSnapshot(root: string) {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		return buildHarnessSnapshot(root, { source: "init" });
	}

	const activeItemId = workflow.primaryItemId || workflow.items[0]?.id;
	const activeItem = workflow.items.find((item) => item.id === activeItemId) || null;

	return buildHarnessSnapshot(root, {
		source: "init",
		workflow: {
			name: workflow.name,
			stages: workflow.stages,
			items: workflow.items,
		},
		activeStageId: activeItem?.stage || workflow.stages[0]?.id,
		primaryItemId: activeItemId,
	});
}

export function formatHermesContent(snapshot: ReturnType<typeof buildHermesSnapshot>) {
	return formatAdapterContent(snapshot, "text", {
		source: "init",
		displayName: "Hermes Agent",
	});
}

export function generateHermesAdapter(root: string): string | null {
	const snapshot = buildHermesSnapshot(root);
	if (!snapshot.hasWorkflow) {
		return null;
	}
	return formatHermesContent(snapshot);
}
