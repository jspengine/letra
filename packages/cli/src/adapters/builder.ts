import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readFocusFile } from "./focus-sync.js";
import { loadHealthRecord } from "../health-record.js";
import type { GenerateOptions, HarnessItem, HarnessSnapshot } from "./types.js";

function countACs(root: string, specName: string | null): { pending: number; total: number } {
	if (!specName) return { pending: 0, total: 0 };
	const specDir = join(root, ".letra", "specs", specName);
	if (!existsSync(specDir)) return { pending: 0, total: 0 };

	let content = "";
	const acceptancePath = join(specDir, "acceptance.md");
	const specPath = join(specDir, "spec.md");
	if (existsSync(acceptancePath)) {
		content = readFileSync(acceptancePath, "utf-8");
	} else if (existsSync(specPath)) {
		content = readFileSync(specPath, "utf-8");
		const acMatch = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/);
		if (acMatch) content = acMatch[1];
		else return { pending: 0, total: 0 };
	} else {
		return { pending: 0, total: 0 };
	}

	const total = (content.match(/- \[.?] \*\*AC/g) || []).length;
	const pending = (content.match(/- \[ ] \*\*AC/g) || []).length;
	return { pending, total };
}

function loadLastSession(root: string): { lastDate: string; actionsSummary: string } | null {
	const logPath = join(root, ".letra", "session-log.json");
	if (!existsSync(logPath)) return null;
	try {
		const log = JSON.parse(readFileSync(logPath, "utf-8"));
		const entries = log.entries || [];
		if (entries.length === 0) return null;
		const lastEntry = entries[0];
		const actions = entries.slice(0, 5).map((e: { action: string; description: string }) =>
			`${e.action}: ${e.description?.slice(0, 50)}`,
		);
		return {
			lastDate: new Date(lastEntry.timestamp).toLocaleString("pt-BR"),
			actionsSummary: actions.join("\n  • "),
		};
	} catch {
		return null;
	}
}

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
			pendingACs: 0,
			totalACs: 0,
		};
	}

	const { workflow, activeStageId } = options;
	const stage = workflow.stages.find((s) => s.id === activeStageId);
	const stageItems = workflow.items.filter((item) => item.stage === activeStageId);

	let nextStage: { id: string; name: string } | undefined;
	if (stage) {
		const hasOrder = workflow.stages.some((s) => s.order !== undefined);
		const sorted = hasOrder
			? [...workflow.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
			: workflow.stages;
		const currentIdx = sorted.findIndex((s) => s.id === stage.id);
		if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
			const ns = sorted[currentIdx + 1];
			nextStage = { id: ns.id, name: ns.name };
		}
	}

	let primaryItemId: string | null = null;
	if (options.primaryItemId && stageItems.some((i) => i.id === options.primaryItemId)) {
		primaryItemId = options.primaryItemId;
	} else if (stageItems.length > 0) {
		primaryItemId = stageItems[0].id;
	}

	const items: HarnessItem[] = stageItems.map((item) => ({
		id: item.id,
		description: item.description,
		spec: item.spec,
		claimedBy: item.claimedBy,
		claimedAt: item.claimedAt,
	}));

	let focusSpec: string | null = null;
	let focusPath: string | null = null;

	const parsedFocus = readFocusFile(root);
	if (parsedFocus) {
		focusSpec = parsedFocus.specName;
		focusPath = `.letra/specs/${parsedFocus.specName}/`;
	} else {
		const primaryItem = items.find((i) => i.id === primaryItemId);
		if (primaryItem?.spec) {
			focusSpec = primaryItem.spec;
			focusPath = `.letra/specs/${primaryItem.spec}/`;
		}
	}

	const acCounts = countACs(root, focusSpec);
	const lastSession = loadLastSession(root);

	const healthRecord = loadHealthRecord(root);
	const novoAlerts = healthRecord.entries
		.filter((e) => e.status === "novo")
		.slice(0, 5)
		.map((e) => ({
			id: e.id,
			severity: e.severity,
			title: e.title,
			source: e.source,
			detectedAt: e.detectedAt,
		}));

	const totalNovo = healthRecord.entries.filter((e) => e.status === "novo").length;

	return {
		workflowName: workflow.name,
		hasWorkflow: true,
		activeStage: stage
			? { id: stage.id, name: stage.name }
			: { id: activeStageId, name: activeStageId },
		nextStage,
		items,
		hasFocus,
		primaryItemId,
		focusSpec,
		focusPath,
		pendingACs: acCounts.pending,
		totalACs: acCounts.total,
		lastSession,
		alerts: novoAlerts.length > 0
			? [...novoAlerts, ...(totalNovo > 5 ? [{ id: "...", severity: "", title: `e mais ${totalNovo - 5} alertas`, source: "", detectedAt: "" }] : [])]
			: undefined,
	};
}
