import { readdirSync, existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseSimpleYaml } from "./parse";
import type {
	ActivityActionHint,
	ActivityCommandHint,
	ActivityHintConfig,
	ActivityReferenceHint,
	GateExpectationConfig,
	HarnessManifest,
	PhaseAction,
	PhaseDef,
	PhaseHarnessConfig,
	PhaseTransition,
	ReviewExpectationConfig,
	StageDef,
	StageActivityContextConfig,
	StagePhases,
} from "./types";
import { getLetraDir } from "./../workspace/resolver.js";
export { ensureSharedHarness } from "../workspace/resolution.js";

export const DEFAULT_HARNESS_VERSION = "v0.1.0";

export function resolveHarnessRoot(cwd: string, version = DEFAULT_HARNESS_VERSION): string {
	const candidates = [
		join(getLetraDir(cwd), "harness", version),
		join(cwd, "..", ".leta", "harness", version),
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return candidates[0];
}

function unwrapStages(value: unknown): any[] {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object" && Array.isArray((value as any).stages)) return (value as any).stages;
	return [];
}

function normalizeGateDecisions(
	value: unknown,
): HarnessManifest["gates"][string]["decisions"] {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const raw = value as Record<string, unknown>;
	const decisions: NonNullable<HarnessManifest["gates"][string]["decisions"]> = {};
	for (const decision of ["approve", "request-changes", "reject"] as const) {
		if (typeof raw[decision] === "string" && raw[decision].trim()) {
			decisions[decision] = raw[decision].trim();
		}
	}
	return Object.keys(decisions).length > 0 ? decisions : undefined;
}

function normalizePhaseTransitions(value: unknown): PhaseTransition[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const transitions = value
		.map((entry): PhaseTransition | null => {
			if (!entry || typeof entry !== "object") return null;
			const raw = entry as Record<string, unknown>;
			const target = typeof raw.target === "string" ? raw.target : null;
			if (!target) return null;
			return {
				target,
				gate: typeof raw.gate === "string" ? raw.gate : undefined,
				auto: raw.auto === true,
			};
		})
		.filter((entry): entry is PhaseTransition => entry !== null);
	return transitions.length > 0 ? transitions : undefined;
}

function normalizePhaseActions(value: unknown): PhaseAction[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const actions = value
		.map((entry) => {
			if (!entry || typeof entry !== "object") return null;
			const raw = entry as Record<string, unknown>;
			switch (raw.type) {
				case "agent-prompt":
					return typeof raw.prompt === "string"
						? ({ type: "agent-prompt", prompt: raw.prompt } satisfies PhaseAction)
						: null;
				case "command":
					return typeof raw.cmd === "string"
						? ({ type: "command", cmd: raw.cmd } satisfies PhaseAction)
						: null;
				case "generate-report":
					return typeof raw.template === "string"
						? ({ type: "generate-report", template: raw.template } satisfies PhaseAction)
						: null;
				case "notify-human":
					return typeof raw.message === "string"
						? ({ type: "notify-human", message: raw.message } satisfies PhaseAction)
						: null;
				case "wait-human":
					return typeof raw.gate === "string"
						? ({ type: "wait-human", gate: raw.gate } satisfies PhaseAction)
						: null;
				default:
					return null;
			}
		})
		.filter((entry): entry is PhaseAction => entry !== null);
	return actions.length > 0 ? actions : undefined;
}

function normalizePhaseHarness(value: unknown): PhaseHarnessConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const checks = Array.isArray(raw.checks)
		? raw.checks.map(String)
		: typeof raw.checks === "string"
			? raw.checks.split(",").map((entry) => entry.trim()).filter(Boolean)
			: undefined;
	const tools = Array.isArray(raw.tools)
		? raw.tools.map(String)
		: typeof raw.tools === "string"
			? raw.tools.split(",").map((entry) => entry.trim()).filter(Boolean)
			: undefined;
	const config: PhaseHarnessConfig = {};
	if (typeof raw.instructions === "string") config.instructions = raw.instructions;
	if (checks && checks.length > 0) config.checks = checks;
	if (tools && tools.length > 0) config.tools = tools;
	const activity = normalizeStageActivity(raw.activity);
	if (activity) config.activity = activity;
	const review = normalizeReviewExpectation(raw.review);
	const gate = normalizeGateExpectation(raw.gate);
	if (review) config.review = review;
	if (gate) config.gate = gate;
	return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeReferenceHints(value: unknown): ActivityReferenceHint[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const hints = value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const raw = entry as Record<string, unknown>;
		return typeof raw.path === "string" && typeof raw.reason === "string"
			? [{ path: raw.path, reason: raw.reason }]
			: [];
	});
	return hints;
}

function normalizeActionHints(value: unknown): ActivityActionHint[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const hints = value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const raw = entry as Record<string, unknown>;
		return typeof raw.label === "string" && typeof raw.description === "string"
			? [{ label: raw.label, description: raw.description }]
			: [];
	});
	return hints;
}

function normalizeCommandHints(value: unknown): ActivityCommandHint[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const hints = value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const raw = entry as Record<string, unknown>;
		return typeof raw.command === "string" && typeof raw.label === "string"
			? [{
					command: raw.command,
					label: raw.label,
					description: typeof raw.description === "string" ? raw.description : undefined,
				}]
			: [];
	});
	return hints;
}

function applyCommonActivityHints(
	raw: Record<string, unknown>,
	config: ActivityHintConfig,
): void {
	if (typeof raw.objective === "string") config.objective = raw.objective;
	const mustRead = normalizeReferenceHints(raw.mustRead);
	if (mustRead !== undefined) config.mustRead = mustRead;
	if (Array.isArray(raw.mustNotDo)) {
		config.mustNotDo = raw.mustNotDo.map(String);
	}
	const nextActions = normalizeActionHints(raw.nextActions);
	if (nextActions !== undefined) config.nextActions = nextActions;
	const commands = normalizeCommandHints(raw.commands);
	if (commands !== undefined) config.commands = commands;
}

function normalizeActivityHint(value: unknown): ActivityHintConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const config: ActivityHintConfig = {};
	applyCommonActivityHints(raw, config);
	return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeReviewExpectation(value: unknown): ReviewExpectationConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const config: ReviewExpectationConfig = {};
	applyCommonActivityHints(raw, config);
	if (typeof raw.label === "string") config.label = raw.label;
	if (typeof raw.emphasis === "string") config.emphasis = raw.emphasis;
	if (typeof raw.riskFocus === "string") config.riskFocus = raw.riskFocus;
	if (typeof raw.evidencePrompt === "string") config.evidencePrompt = raw.evidencePrompt;
	if (typeof raw.signalCode === "string") config.signalCode = raw.signalCode;
	return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeGateExpectation(value: unknown): GateExpectationConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const config: GateExpectationConfig = {};
	applyCommonActivityHints(raw, config);
	if (typeof raw.label === "string") config.label = raw.label;
	if (typeof raw.evidence === "string") config.evidence = raw.evidence;
	if (typeof raw.decision === "string") config.decision = raw.decision;
	if (typeof raw.signalCode === "string") config.signalCode = raw.signalCode;
	return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeStageActivity(value: unknown): StageActivityContextConfig | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const config: StageActivityContextConfig = {};
	const design = normalizeActivityHint(raw.design);
	const implement = normalizeActivityHint(raw.implement);
	const review = normalizeReviewExpectation(raw.review);
	const diagnose = normalizeActivityHint(raw.diagnose);
	const gate = normalizeGateExpectation(raw.gate);
	if (design) config.design = design;
	if (implement) config.implement = implement;
	if (review) config.review = review;
	if (diagnose) config.diagnose = diagnose;
	if (gate) config.gate = gate;
	return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeStagePhases(value: unknown): StagePhases | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const initialState = typeof raw.initialState === "string" ? raw.initialState : null;
	const rawStates = raw.states;
	if (!initialState || !rawStates || typeof rawStates !== "object") return undefined;
	const states = Object.entries(rawStates as Record<string, unknown>).reduce<Record<string, PhaseDef>>((acc, [phaseId, entry]) => {
		if (!entry || typeof entry !== "object") return acc;
		const rawPhase = entry as Record<string, unknown>;
		const id = typeof rawPhase.id === "string" ? rawPhase.id : phaseId;
		const label = typeof rawPhase.label === "string" ? rawPhase.label : id;
		const description = typeof rawPhase.description === "string" ? rawPhase.description : "";
		acc[id] = {
			id,
			label,
			description,
			actions: normalizePhaseActions(rawPhase.actions),
			transitions: normalizePhaseTransitions(rawPhase.transitions),
			harness: normalizePhaseHarness(rawPhase.harness),
		};
		return acc;
	}, {});
	if (!states[initialState]) return undefined;
	return { initialState, states };
}

export function loadHarness(root: string): HarnessManifest | null {
	const harnessDir = root;
	if (!existsSync(harnessDir)) return null;

	const flowsDir = join(harnessDir, "flows");
	const gatesDir = join(harnessDir, "gates");
	const rolesDir = join(harnessDir, "roles");
	const policiesDir = join(harnessDir, "policies");

	if (!existsSync(flowsDir) || !existsSync(gatesDir) || !existsSync(rolesDir)) return null;

	const flows: Record<string, HarnessManifest["flows"][string]> = {};
	if (existsSync(flowsDir)) {
		for (const file of readdirSync(flowsDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(flowsDir, file), "utf-8"));
			flows[String(raw.id)] = {
				id: String(raw.id),
				version: String(raw.version ?? "0.0.0"),
				name: String(raw.name ?? raw.id),
				description: String(raw.description ?? ""),
				defaultPolicy: String(raw.defaultPolicy ?? ""),
				stages: unwrapStages(raw.stages).map((s: any) => ({
					id: String(s.id ?? ""),
					name: String(s.name ?? s.id ?? ""),
					order: typeof s.order === "number" ? s.order : Number(s.order ?? 0),
					zone: ["todo", "doing", "done"].includes(s.zone)
						? (s.zone as StageDef["zone"])
						: undefined,
					description: String(s.description ?? ""),
					agents: Array.isArray(s.agents)
						? s.agents.map((a: any) => String(a))
						: typeof s.agents === "string"
							? s.agents.split(",").map((a: string) => a.trim()).filter(Boolean)
							: [],
					gate: typeof s.gate === "string" && s.gate.trim() ? s.gate.trim() : null,
					phases: normalizeStagePhases(s.phases),
					activity: normalizeStageActivity(s.activity),
				})),
			};
		}
	}

	const gates: Record<string, HarnessManifest["gates"][string]> = {};
	if (existsSync(gatesDir)) {
		for (const file of readdirSync(gatesDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(gatesDir, file), "utf-8"));
			gates[String(raw.id)] = {
				id: String(raw.id),
				name: String(raw.name ?? raw.id),
				type: ["human", "automated", "external"].includes(raw.type as string)
					? (raw.type as HarnessManifest["gates"][string]["type"])
					: "automated",
				blocking: raw.blocking === true,
				policyRef: (raw.policyRef as string | undefined) ?? undefined,
				description: String(raw.description ?? ""),
				decisions: normalizeGateDecisions(raw.decisions),
			};
		}
	}

	const roles: Record<string, HarnessManifest["roles"][string]> = {};
	if (existsSync(rolesDir)) {
		for (const file of readdirSync(rolesDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(rolesDir, file), "utf-8"));
			const capabilities = Array.isArray(raw.capabilities)
				? raw.capabilities.map(String)
				: typeof raw.capabilities === "string"
					? raw.capabilities.split(",").map((a: string) => a.trim()).filter(Boolean)
					: [];
			roles[String(raw.id)] = {
				id: String(raw.id),
				label: String(raw.label ?? raw.id),
				description: String(raw.description ?? ""),
				allowedStages: Array.isArray(raw.allowedStages)
					? raw.allowedStages.map(String)
					: typeof raw.allowedStages === "string"
						? raw.allowedStages.split(",").map((a: string) => a.trim()).filter(Boolean)
						: [],
				capabilities,
			};
		}
	}

	const policies: Record<string, HarnessManifest["policies"][string]> = {};
	if (existsSync(policiesDir)) {
		for (const file of readdirSync(policiesDir)) {
			if (!file.endsWith(".json")) continue;
			try {
				const p = JSON.parse(readFileSync(join(policiesDir, file), "utf-8"));
				policies[String(p.id)] = p as HarnessManifest["policies"][string];
			} catch {
				// ignore malformed policy
			}
		}
	}

	return {
		version: basename(harnessDir).replace(/^v/, ""),
		flows,
		gates,
		roles,
		policies,
	};
}
