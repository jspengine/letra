import type { Workflow, Item } from "../commands/flow-init.js";
import type { PhaseDef, StagePhases } from "../harness/types.js";
import { PhaseActionRunner } from "./runner.js";

export interface PhaseEngineResult {
	ok: boolean;
	phase?: string;
	error?: string;
	triggeredActions?: string[];
	triggeredAutoTransition?: boolean;
}

export function getStagePhases(workflow: Workflow, stageId: string): StagePhases | null {
	const stage = workflow.stages.find((s) => s.id === stageId);
	if (!stage) return null;
	return (stage as { phases?: StagePhases }).phases ?? null;
}

export function getPhaseDef(phases: StagePhases, phaseId: string): PhaseDef | null {
	return phases.states[phaseId] ?? null;
}

export function enterStage(workflow: Workflow, item: Item): PhaseEngineResult {
	const phases = getStagePhases(workflow, item.stage);
	if (!phases) {
		item.currentPhase = undefined;
		return { ok: true, phase: undefined };
	}
	const initial = phases.initialState;
	if (!phases.states[initial]) {
		return { ok: false, error: `Initial phase "${initial}" not defined in stage "${item.stage}"` };
	}
	item.currentPhase = initial;
	return { ok: true, phase: initial, triggeredActions: ["enterStage"], triggeredAutoTransition: false };
}

const _runner = new PhaseActionRunner();

export function transitionPhase(
	root: string | undefined,
	workflow: Workflow,
	item: Item,
	targetPhaseId: string,
): PhaseEngineResult {
	const phases = getStagePhases(workflow, item.stage);
	if (!phases) {
		return { ok: false, error: `Stage "${item.stage}" has no phases defined` };
	}

	const currentDef = item.currentPhase ? getPhaseDef(phases, item.currentPhase) : null;
	const transition = currentDef?.transitions?.find((t) => t.target === targetPhaseId);

	if (targetPhaseId === "__EXIT__") {
		if (!transition) {
			const allowed = (currentDef?.transitions ?? []).map((t) => t.target).join(", ");
			return {
				ok: false,
				error: `Transition from "${item.currentPhase}" to "__EXIT__" not allowed. Allowed: ${allowed || "none"}`,
			};
		}
		item.currentPhase = undefined;
		return { ok: true, phase: undefined, triggeredActions: [], triggeredAutoTransition: false };
	}

	if (!phases.states[targetPhaseId]) {
		return { ok: false, error: `Phase "${targetPhaseId}" not found in stage "${item.stage}"` };
	}

	if (currentDef && !transition) {
		const allowed = (currentDef.transitions ?? []).map((t) => t.target).join(", ");
		return {
			ok: false,
			error: `Transition from "${item.currentPhase}" to "${targetPhaseId}" not allowed. Allowed: ${allowed || "none"}`,
		};
	}

	item.currentPhase = targetPhaseId;

	const targetDef = getPhaseDef(phases, targetPhaseId);
	let actions: string[] = [];
	if (root && targetDef) {
		const result = _runner.execPhase(root, item, targetDef);
		actions = result.actions;
		if (!result.ok) {
			return {
				ok: false,
				error: result.error,
				phase: item.currentPhase,
				triggeredActions: actions,
			};
		}
	} else {
		actions = (targetDef?.actions ?? []).map((a) => {
			if (a.type === "agent-prompt") return `agent-prompt: ${a.prompt}`;
			if (a.type === "command") return `command: ${a.cmd}`;
			if (a.type === "generate-report") return `generate-report: ${a.template}`;
			if (a.type === "notify-human") return `notify-human: ${a.message}`;
			if (a.type === "wait-human") return `wait-human: ${a.gate}`;
			return `unknown action`;
		});
	}

	let triggeredAutoTransition = false;
	if (transition?.auto) {
		const nextAuto = targetDef?.transitions?.find((t) => t.auto);
		if (nextAuto && phases.states[nextAuto.target]) {
			item.currentPhase = nextAuto.target;
			triggeredAutoTransition = true;
		}
	}

	return {
		ok: true,
		phase: item.currentPhase,
		triggeredActions: actions,
		triggeredAutoTransition,
	};
}

export function getPhaseHarness(
	workflow: Workflow,
	item: Item,
): { instructions?: string; tools?: string[]; checks?: string[] } | null {
	const phases = getStagePhases(workflow, item.stage);
	if (!phases || !item.currentPhase) return null;
	const def = getPhaseDef(phases, item.currentPhase);
	return def?.harness ?? null;
}
