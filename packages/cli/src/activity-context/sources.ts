import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWorkflow } from "../commands/flow-init.js";
import type { Item, Workflow } from "../commands/flow-init.js";
import { loadHealthRecord, getActiveEntries } from "../health-record.js";
import type { HealthEntry } from "../health-record.js";
import { queryLog } from "../session-log.js";
import type { LogEntry } from "../session-log.js";
import { resolveActiveFlowFor } from "../flow-definition/resolve.js";
import { readExecutionRuns } from "../execution-runs/store.js";
import type { ResolvedFlowPhase, ResolvedFlowStage } from "../flow-definition/types.js";
import type {
	GateExpectationConfig,
	PhaseHarnessConfig,
	ReviewExpectationConfig,
} from "../harness/types.js";
import { getLetraDir } from "./../workspace/resolver.js";

export interface SpecMeta {
	name: string;
	path: string;
	outcome: string | null;
	acs: { pending: number; done: number; total: number };
}

export interface ActivityContextSources {
	workflow: Workflow | null;
	currentItem: Item | null;
	currentPhase: string | null;
	activeFlowStage: ResolvedFlowStage | null;
	activePhaseDef: ResolvedFlowPhase | null;
	activePhaseHarness: PhaseHarnessConfig | null;
	activeReviewExpectation: ReviewExpectationConfig | null;
	activeGateExpectation: GateExpectationConfig | null;
	focus: null;
	focusDiverged: boolean;
	spec: SpecMeta | null;
	activeAlerts: HealthEntry[];
	lastActions: LogEntry[];
}

export function getStageName(workflow: Workflow, stageId: string): string {
	return workflow.stages.find((stage) => stage.id === stageId)?.name ?? stageId;
}

export function findCurrentItem(workflow: Workflow): Item | null {
	const activeStages = workflow.stages
		.filter(
			(stage) =>
				stage.zone === "doing" ||
				(!stage.zone && stage.order > 0 && stage.order < workflow.stages.length - 1),
		)
		.map((stage) => stage.id);
	const stageSet = new Set(activeStages);
	if (stageSet.size === 0) {
		const middle = Math.floor(workflow.stages.length / 2);
		const stage = workflow.stages[middle];
		if (stage) stageSet.add(stage.id);
	}
	const items = workflow.items.filter((item) => stageSet.has(item.stage));
	if (items.length === 0) return null;
	return items.reduce((left, right) =>
		new Date(left.createdAt) > new Date(right.createdAt) ? left : right,
	);
}

function extractOutcome(content: string): string | null {
	const match = content.match(/## Outcome\s+([\s\S]*?)(?=\n## |\n*$)/);
	return match ? match[1].trim() : null;
}

function countSpecACs(content: string): { pending: number; done: number; total: number } {
	const boldPending = content.match(/-\s*\[ \]\s*\*\*AC[-]?\d+\*\*/g) || [];
	const boldDone = content.match(/-\s*\[[xX]\]\s*\*\*AC[-]?\d+\*\*/g) || [];
	if (boldPending.length > 0 || boldDone.length > 0) {
		return {
			pending: boldPending.length,
			done: boldDone.length,
			total: boldPending.length + boldDone.length,
		};
	}
	const genericPending = content.match(/^- \[ \]\s+AC[-]?\d+/gm) || [];
	const genericDone = content.match(/^- \[[xX]\]\s+AC[-]?\d+/gm) || [];
	return {
		pending: genericPending.length,
		done: genericDone.length,
		total: genericPending.length + genericDone.length,
	};
}

export function loadSpecMeta(root: string, specName: string | null): SpecMeta | null {
	if (!specName) return null;
	const specPath = join(getLetraDir(root), "specs", specName, "spec.md");
	if (!existsSync(specPath)) {
		return {
			name: specName,
			path: `.letra/specs/${specName}/spec.md`,
			outcome: null,
			acs: { pending: 0, done: 0, total: 0 },
		};
	}
	const content = readFileSync(specPath, "utf-8");
	return {
		name: specName,
		path: `.letra/specs/${specName}/spec.md`,
		outcome: extractOutcome(content),
		acs: countSpecACs(content),
	};
}

export function loadActivityContextSources(root: string, itemId?: string | null, runId?: string | null): ActivityContextSources {
	const workflow = loadWorkflow(root);
	const selectedRun = runId ? readExecutionRuns(root).runs.find((run) => run.id === runId) : null;
	const flowResolution = resolveActiveFlowFor(root, workflow, {
		itemId: itemId ?? undefined,
		workflowVersionId: selectedRun?.workflowVersionId,
	});
	const focus = null;
	const focusedItem =
		workflow && itemId
			? (workflow.items.find((item) => item.id === itemId) ?? null)
			: null;
	const currentItem = focusedItem ?? null;
	const currentPhase = currentItem?.currentPhase ?? null;
	const activeFlowStage = currentItem
		? (flowResolution.flow?.stages.find((stage) => stage.id === currentItem.stage) ?? null)
		: null;
	const activePhaseDef =
		currentPhase && activeFlowStage?.phases?.states?.[currentPhase]
			? activeFlowStage.phases.states[currentPhase]
			: null;
	const activePhaseHarness = activePhaseDef?.harness ?? null;
	const activeReviewExpectation =
		activePhaseHarness?.activity?.review ??
		activePhaseHarness?.review ??
		activeFlowStage?.activity?.review ??
		null;
	const activeGateExpectation =
		activePhaseHarness?.activity?.gate ??
		activePhaseHarness?.gate ??
		activeFlowStage?.activity?.gate ??
		null;
	const focusDiverged = !!(focus && currentItem?.spec && focus.specName !== currentItem.spec);
	const specName = currentItem?.spec ?? null;
	const spec = loadSpecMeta(root, specName);
	const activeAlerts = getActiveEntries(loadHealthRecord(root));
	const lastActions = queryLog(root, { all: false, limit: 5 });

	return {
		workflow,
		currentItem,
		currentPhase,
		activeFlowStage,
		activePhaseDef,
		activePhaseHarness,
		activeReviewExpectation,
		activeGateExpectation,
		focus,
		focusDiverged,
		spec,
		activeAlerts,
		lastActions,
	};
}
