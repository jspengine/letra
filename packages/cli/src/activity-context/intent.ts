import type { ResolvedFlowPhase } from "../flow-definition/types.js";
import type {
	ActivityHintConfig,
	GateExpectationConfig,
	ReviewExpectationConfig,
	StageActivityContextConfig,
} from "../harness/types.js";
import {
	getCompatibilityActivityIntent,
	type CompatibilityIntentContext,
} from "./compatibility.js";
import type { ActivityContextAction, ActivityContextReference, ActivityKind } from "./types.js";
import type { ActivityContextSources } from "./sources.js";

export type ActivityHintSource = "phase" | "stage" | "flow" | "compatibility";

export interface ResolvedActivityIntent {
	objective: string;
	mustRead: ActivityContextReference[];
	mustNotDo: string[];
	nextActions: ActivityContextAction[];
	provenance: {
		objective: ActivityHintSource;
		mustRead: ActivityHintSource;
		mustNotDo: ActivityHintSource;
		nextActions: ActivityHintSource;
	};
	warnings: string[];
	signal: { code: string; message: string } | null;
}

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function activityHint(
	config: StageActivityContextConfig | null | undefined,
	activity: ActivityKind,
): ActivityHintConfig | undefined {
	return config?.[activity];
}

function cloneHint<T extends ActivityHintConfig>(hint: T | undefined): T | undefined {
	if (!hint) return undefined;
	return {
		...hint,
		mustRead: hint.mustRead?.map((reference) => ({ ...reference })),
		mustNotDo: hint.mustNotDo ? [...hint.mustNotDo] : undefined,
		nextActions: hint.nextActions?.map((action) => ({ ...action })),
	} as T;
}

function mergeHints<T extends ActivityHintConfig>(
	base: T | undefined,
	override: T | undefined,
): T | undefined {
	if (!base) return cloneHint(override);
	if (!override) return cloneHint(base);
	return {
		...cloneHint(base),
		...cloneHint(override),
		mustRead: override.mustRead
			? override.mustRead.map((reference) => ({ ...reference }))
			: base.mustRead?.map((reference) => ({ ...reference })),
		mustNotDo: override.mustNotDo
			? [...override.mustNotDo]
			: base.mustNotDo
				? [...base.mustNotDo]
				: undefined,
		nextActions: override.nextActions
			? override.nextActions.map((action) => ({ ...action }))
			: base.nextActions?.map((action) => ({ ...action })),
	} as T;
}

function resolveReview(
	sources: ActivityContextSources,
	stageHint: ReviewExpectationConfig | undefined,
	phaseHint: ReviewExpectationConfig | undefined,
): {
	config: ReviewExpectationConfig | undefined;
	label: string;
	emphasis: string;
	code: string;
} | null {
	const config = mergeHints(stageHint, phaseHint);
	const phase = sources.activePhaseDef;
	const stageName = sources.activeFlowStage?.name;
	if (!config && !phase && !stageName) return null;
	const label = config?.label ?? phase?.label ?? stageName ?? "Review atual";
	const emphasis =
		config?.emphasis ??
		sources.activePhaseHarness?.checks?.join(", ") ??
		sources.activePhaseHarness?.instructions ??
		phase?.description ??
		"aderência à spec, riscos e evidências do trabalho entregue";
	return {
		config,
		label,
		emphasis,
		code:
			config?.signalCode ??
			`review-${slug(config?.label ?? phase?.id ?? stageName ?? "current")}`,
	};
}

function resolveGate(
	sources: ActivityContextSources,
	stageHint: GateExpectationConfig | undefined,
	phaseHint: GateExpectationConfig | undefined,
): {
	config: GateExpectationConfig | undefined;
	label: string;
	evidence: string;
	decision: string;
	code: string;
} | null {
	const config = mergeHints(stageHint, phaseHint);
	const stageName = sources.activeFlowStage?.name;
	const gate = sources.activeFlowStage?.gate;
	if (!config && !gate && !stageName) return null;
	const label =
		config?.label ??
		gate?.name ??
		(stageName ? `Aprovação humana para ${stageName}` : "Aprovação humana do estágio atual");
	return {
		config,
		label,
		evidence:
			config?.evidence ??
			gate?.description ??
			"estado do item, riscos e evidências relevantes do workflow",
		decision: config?.decision ?? label,
		code: config?.signalCode ?? `gate-${slug(stageName ?? label) || "current"}`,
	};
}

function phaseActivityConfig(
	sources: ActivityContextSources,
): StageActivityContextConfig | undefined {
	return sources.activePhaseHarness?.activity as StageActivityContextConfig | undefined;
}

function specializedPhaseHint(
	sources: ActivityContextSources,
	activity: ActivityKind,
): ActivityHintConfig | undefined {
	if (activity === "review") {
		return sources.activePhaseHarness?.review as ReviewExpectationConfig | undefined;
	}
	if (activity === "gate") {
		return sources.activePhaseHarness?.gate as GateExpectationConfig | undefined;
	}
	return undefined;
}

function setSection<K extends keyof ResolvedActivityIntent["provenance"]>(
	intent: ResolvedActivityIntent,
	key: K,
	hint: ActivityHintConfig,
	source: ActivityHintSource,
): void {
	const value = hint[key];
	if (value === undefined) return;
	(intent[key] as unknown) = Array.isArray(value)
		? value.map((entry) => (typeof entry === "object" ? { ...entry } : entry))
		: value;
	intent.provenance[key] = source;
}

export function resolveActivityIntent(
	activity: ActivityKind,
	sources: ActivityContextSources,
): ResolvedActivityIntent {
	const stageConfig = sources.activeFlowStage?.activity as StageActivityContextConfig | undefined;
	const stageHint = activityHint(stageConfig, activity);
	const phaseDeclaredHint = activityHint(phaseActivityConfig(sources), activity);
	const phaseHint = mergeHints(specializedPhaseHint(sources, activity), phaseDeclaredHint);
	const review =
		activity === "review"
			? resolveReview(
					sources,
					stageHint as ReviewExpectationConfig | undefined,
					phaseHint as ReviewExpectationConfig | undefined,
				)
			: null;
	const gate =
		activity === "gate"
			? resolveGate(
					sources,
					stageHint as GateExpectationConfig | undefined,
					phaseHint as GateExpectationConfig | undefined,
				)
			: null;
	const compatibilityContext: CompatibilityIntentContext = {
		specName: sources.spec?.name ?? null,
		hasFocus: !!sources.focus,
		hasCurrentItem: !!sources.currentItem,
		review: review
			? {
					emphasis: review.emphasis,
					riskFocus: review.config?.riskFocus,
					evidencePrompt: review.config?.evidencePrompt,
				}
			: undefined,
		gate: gate
			? { label: gate.label, evidence: gate.evidence, decision: gate.decision }
			: undefined,
	};
	const compatibility = getCompatibilityActivityIntent(activity, compatibilityContext);
	const intent: ResolvedActivityIntent = {
		...compatibility,
		provenance: {
			objective: "compatibility",
			mustRead: "compatibility",
			mustNotDo: "compatibility",
			nextActions: "compatibility",
		},
		warnings: [],
		signal: review
			? { code: review.code, message: `Review atual: ${review.label}.` }
			: gate
				? { code: gate.code, message: `Gate esperado: ${gate.label}.` }
				: null,
	};
	if (stageHint) {
		setSection(intent, "objective", stageHint, "stage");
		setSection(intent, "mustRead", stageHint, "stage");
		setSection(intent, "mustNotDo", stageHint, "stage");
		setSection(intent, "nextActions", stageHint, "stage");
	}
	if (phaseHint) {
		setSection(intent, "objective", phaseHint, "phase");
		setSection(intent, "mustRead", phaseHint, "phase");
		setSection(intent, "mustNotDo", phaseHint, "phase");
		setSection(intent, "nextActions", phaseHint, "phase");
	}
	const fallbackSections = Object.entries(intent.provenance)
		.filter(([, source]) => source === "compatibility")
		.map(([section]) => section);
	if (fallbackSections.length > 0) {
		intent.warnings.push(
			`ACTIVITY_HINT_COMPATIBILITY_FALLBACK:${activity}:${fallbackSections.join(",")}`,
		);
	}
	return intent;
}
