import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFocusFile } from "./focus-sync.js";
import { loadHealthRecord } from "../health-record.js";
import type {
	GenerateOptions,
	HarnessItem,
	HarnessSnapshot,
	HandoffStep,
	HarnessDirectionData,
	HarnessDirectionActivity,
} from "./types.js";
import type {
	StagePhases,
	StageDef,
	ActivityCommandHint,
	ActivityActionHint,
} from "../harness/types.js";
import { loadHarness, resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "../harness/loader.js";
import { loadWorkflow } from "../commands/flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";
import { queryLog } from "../session-log.js";

function countACs(
	stateDir: string,
	specName: string | null,
): { pending: number; total: number; pendingIds: string[] } {
	if (!specName) return { pending: 0, total: 0, pendingIds: [] };
	let specDir = join(stateDir, "specs", specName);
	if (!existsSync(specDir)) {
		const legacyDir = join(getLetraDir(stateDir), "specs", specName);
		if (!existsSync(legacyDir)) return { pending: 0, total: 0, pendingIds: [] };
		specDir = legacyDir;
	}

	let content = "";
	const acceptancePath = join(specDir, "acceptance.md");
	const specPath = join(specDir, "spec.md");
	if (existsSync(acceptancePath)) {
		content = readFileSync(acceptancePath, "utf-8");
	} else if (existsSync(specPath)) {
		content = readFileSync(specPath, "utf-8");
		const acMatch = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/);
		if (acMatch) content = acMatch[1];
		else return { pending: 0, total: 0, pendingIds: [] };
	} else {
		return { pending: 0, total: 0, pendingIds: [] };
	}

	const total = (content.match(/- \[.?] \*\*AC/g) || []).length;
	const pending = (content.match(/- \[ ] \*\*AC/g) || []).length;
	const pendingIds = [...content.matchAll(/-\s\[ \]\s\*\*([^*]+)\*\*/g)].map((m) => m[1]);
	return { pending, total, pendingIds };
}

function loadLastSession(stateDir: string): { lastDate: string; actionsSummary: string } | null {
	let logPath = join(stateDir, "session-log.json");
	if (!existsSync(logPath)) {
		const legacy = join(getLetraDir(stateDir), "session-log.json");
		if (!existsSync(legacy)) return null;
		logPath = legacy;
	}
	try {
		const log = JSON.parse(readFileSync(logPath, "utf-8"));
		const entries = log.entries || [];
		if (entries.length === 0) return null;
		const lastEntry = entries[0];
		const actions = entries
			.slice(0, 5)
			.map(
				(e: { action: string; description: string }) =>
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

function loadHarnessDirection(root: string, activeStageId: string): HarnessDirectionData | null {
	const workflow = loadWorkflow(root);
	if (!workflow) return null;
	const version = workflow.harnessVersion ?? DEFAULT_HARNESS_VERSION;
	const harnessRoot = resolveHarnessRoot(root, version);
	const harness = loadHarness(harnessRoot);
	if (!harness) return null;
	const templateId = workflow.template ?? "flow-main";
	const flow = harness.flows?.[templateId];
	if (!flow) return null;
	const stageDef = flow.stages?.find((s: StageDef) => s.id === activeStageId);
	if (!stageDef) return null;

	const activities: HarnessDirectionActivity[] = [];
	const activityConfig = stageDef.activity;
	if (activityConfig) {
		const kinds = ["design", "implement", "review", "diagnose", "gate"] as const;
		for (const kind of kinds) {
			const hint = activityConfig[kind];
			if (!hint) continue;
			activities.push({
				kind,
				objective: hint.objective,
				mustNotDo: hint.mustNotDo,
				commands: hint.commands?.map((c: ActivityCommandHint) => ({
					command: c.command ?? "",
					label: c.label ?? "",
					description: c.description,
				})),
				nextActions: hint.nextActions?.map((a: ActivityActionHint) => ({
					label: a.label ?? "",
					description: a.description ?? "",
				})),
			});
		}
	}

	return {
		harnessVersion: version,
		roleIds: stageDef.agents ?? [],
		activities,
	};
}

export function buildHarnessSnapshot(root: string, options: GenerateOptions): HarnessSnapshot {
	const isWorkspace = options.workspaceDir !== undefined;
	const stateDir = isWorkspace ? (options.workspaceDir ?? root) : root;
	const dotLetra = isWorkspace ? stateDir : getLetraDir(stateDir);
	const hasFocus = existsSync(join(dotLetra, "focus.md"));
	const buildReferenceLinks = (specName: string | null): HarnessSnapshot["referenceLinks"] => ({
		context: pathToFileURL(join(dotLetra, "context.md")).href,
		constitution: pathToFileURL(join(dotLetra, "constitution.md")).href,
		glossary: pathToFileURL(join(dotLetra, "glossary.md")).href,
		constraints: pathToFileURL(join(dotLetra, "constraints.md")).href,
		focus: hasFocus ? pathToFileURL(join(dotLetra, "focus.md")).href : null,
		spec: specName ? pathToFileURL(join(dotLetra, "specs", specName, "spec.md")).href : null,
		workflow: pathToFileURL(join(dotLetra, "workflow.json")).href,
	});

	if (!options.workflow || !options.activeStageId) {
		return {
			workflowName: "letra",
			hasWorkflow: false,
			items: [],
			hasFocus,
			primaryItemId: null,
			focusSpec: null,
			focusPath: null,
			referenceLinks: buildReferenceLinks(null),
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
		focusPath = `${isWorkspace ? "specs/" : ".letra/specs/"}${parsedFocus.specName}/`;
	} else {
		const primaryItem = items.find((i) => i.id === primaryItemId);
		if (primaryItem?.spec) {
			focusSpec = primaryItem.spec;
			focusPath = `${isWorkspace ? "specs/" : ".letra/specs/"}${primaryItem.spec}/`;
		}
	}

	const acCounts = countACs(dotLetra, focusSpec);
	const lastSession = loadLastSession(dotLetra);

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

	// Look up current phase for primary item from stage phases definition
	let currentPhase: HarnessSnapshot["currentPhase"];
	if (primaryItemId && stage) {
		const primaryItemData = workflow.items.find((i) => i.id === primaryItemId);
		const phaseId = primaryItemData?.currentPhase;
		if (phaseId) {
			const stagePhases = (stage as { phases?: StagePhases }).phases ?? null;
			if (stagePhases?.states?.[phaseId]) {
				const phaseDef = stagePhases.states[phaseId];
				currentPhase = {
					id: phaseDef.id,
					label: phaseDef.label,
					description: phaseDef.description,
					harness: phaseDef.harness,
				};
			}
		}
	}

	// Build handoff data
	let handoff: HarnessSnapshot["handoff"];
	if (primaryItemId) {
		const rawHandoff = (workflow as Record<string, unknown>).handoff as
			| Record<string, unknown>
			| boolean
			| undefined;
		const handoffEnabled =
			rawHandoff === false
				? false
				: (rawHandoff as Record<string, unknown>)?.enabled !== false;
		if (handoffEnabled) {
			const defaultSteps: HandoffStep[] = [
				{
					command: "letra validate",
					label: "validate",
					recovery: "letra diagnose — encontrar e corrigir problemas",
				},
				{
					command: "letra pulse",
					label: "pulse",
					recovery: "letra health — checar alertas ativos",
				},
				{
					command: "letra sitrep",
					label: "sitrep",
					recovery: "corrija o erro e tente novamente",
				},
				{
					command: `letra flow move ${primaryItemId} --to ${nextStage?.id || "proximo_estagio"}`,
					label: "flow move",
					recovery: "letra validate — verificar ACs pendentes",
				},
				{
					command: "npm run build",
					label: "build",
					recovery: "corrija erros de compilação",
				},
			];

			const skipSteps: string[] = Array.isArray(
				(rawHandoff as Record<string, unknown>)?.skipSteps,
			)
				? ((rawHandoff as Record<string, unknown>).skipSteps as string[])
				: [];
			const customSteps: HandoffStep[] = Array.isArray(
				(rawHandoff as Record<string, unknown>)?.customSteps,
			)
				? ((rawHandoff as Record<string, unknown>).customSteps as HandoffStep[])
				: [];

			const filtered = defaultSteps.filter((s) => !skipSteps.includes(s.label));
			const steps = [...filtered, ...customSteps];

			handoff = {
				steps,
				primaryItemId,
				nextStageName: nextStage?.name,
			};
		}
	}

	const pendingACIds = acCounts.pendingIds;
	const harnessDirection = loadHarnessDirection(root, activeStageId) ?? undefined;
	if (harnessDirection && pendingACIds.length > 0) {
		harnessDirection.pendingACIds = pendingACIds;
	}
	if (harnessDirection && primaryItemId) {
		harnessDirection.primaryItemId = primaryItemId;
	}

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
		referenceLinks: buildReferenceLinks(focusSpec),
		pendingACs: acCounts.pending,
		totalACs: acCounts.total,
		lastSession,
		alerts:
			novoAlerts.length > 0
				? [
						...novoAlerts,
						...(totalNovo > 5
							? [
									{
										id: "...",
										severity: "",
										title: `e mais ${totalNovo - 5} alertas`,
										source: "",
										detectedAt: "",
									},
								]
							: []),
					]
				: undefined,
		currentPhase,
		handoff,
		harnessDirection,
	};
}
