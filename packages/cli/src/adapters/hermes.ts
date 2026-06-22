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
    return {
      workflowName: "letra",
      hasWorkflow: false,
      items: [],
      hasFocus: false,
      primaryItemId: null,
      focusSpec: null,
      focusPath: null,
      pendingACs: 0,
      totalACs: 0,
      lastSession: null,
      alerts: undefined,
    } as const;
  }

  const activeItemId = workflow.primaryItemId || workflow.items[0]?.id;
  const activeItem = workflow.items.find((item) => item.id === activeItemId) || null;

  return buildHarnessSnapshot(root, {
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
    source: "hermes",
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
