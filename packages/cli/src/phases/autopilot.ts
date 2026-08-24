import { logEntry } from "../session-log.js";
import { getPhaseDef, getStagePhases, transitionPhase } from "./engine.js";
import { PhaseActionRunner } from "./runner.js";
import type { Workflow, Item } from "../commands/flow-init.js";

const MAX_AUTO_TRANSITIONS = 10;
const runner = new PhaseActionRunner();

export interface AutoPilotResult {
	ok: boolean;
	finalPhase?: string;
	error?: string;
	transitionsApplied: number;
}

function getAutoTarget(workflow: Workflow, item: Item): string | null {
	const phases = getStagePhases(workflow, item.stage);
	if (!phases || !item.currentPhase) return null;
	const def = getPhaseDef(phases, item.currentPhase);
	if (!def) return null;
	const autoTrans = (def.transitions ?? []).find((t) => t.auto);
	return autoTrans?.target ?? null;
}

export class PhaseAutoPilot {
	private transitionsApplied = 0;

	async run(root: string, workflow: Workflow, item: Item): Promise<AutoPilotResult> {
		this.transitionsApplied = 0;

		if (!item.currentPhase) {
			logEntry(root, "system", `autopilot:${item.id} no current phase — nothing to do`, {
				itemId: item.id,
			});
			return { ok: true, finalPhase: undefined, transitionsApplied: 0 };
		}

		logEntry(
			root,
			"system",
			`autopilot:starting for ${item.id} from phase "${item.currentPhase}"`,
			{ itemId: item.id },
		);

		while (this.transitionsApplied < MAX_AUTO_TRANSITIONS) {
			const autoTarget = getAutoTarget(workflow, item);
			if (!autoTarget) {
				logEntry(
					root,
					"system",
					`autopilot:${item.id} stopped at phase "${item.currentPhase}" — no auto-transition`,
					{
						itemId: item.id,
					},
				);
				return {
					ok: true,
					finalPhase: item.currentPhase,
					transitionsApplied: this.transitionsApplied,
				};
			}

			const phases = getStagePhases(workflow, item.stage);
			const phaseDef =
				item.currentPhase && phases ? getPhaseDef(phases, item.currentPhase) : null;
			if (phaseDef) {
				const actionResult = runner.execPhase(root, item, phaseDef);
				if (!actionResult.ok) {
					logEntry(
						root,
						"system",
						`autopilot:${item.id} stopped — action failed: ${actionResult.error}`,
						{
							itemId: item.id,
						},
					);
					return {
						ok: false,
						error: actionResult.error,
						finalPhase: item.currentPhase,
						transitionsApplied: this.transitionsApplied,
					};
				}
			}

			const prevPhase = item.currentPhase;
			const result = transitionPhase(root, workflow, item, autoTarget);
			if (!result.ok) {
				logEntry(
					root,
					"system",
					`autopilot:${item.id} transition failed — ${result.error}`,
					{ itemId: item.id },
				);
				return {
					ok: false,
					error: result.error,
					finalPhase: prevPhase,
					transitionsApplied: this.transitionsApplied,
				};
			}

			this.transitionsApplied++;
			logEntry(
				root,
				"system",
				`autopilot:${item.id} ${prevPhase} → ${item.currentPhase || "__EXIT__"}`,
				{
					itemId: item.id,
				},
			);

			if (!item.currentPhase) {
				logEntry(root, "system", `autopilot:${item.id} exited phase system`, {
					itemId: item.id,
				});
				return {
					ok: true,
					finalPhase: undefined,
					transitionsApplied: this.transitionsApplied,
				};
			}
		}

		const msg = "Auto-loop limit exceeded";
		logEntry(root, "system", `autopilot:${item.id} ${msg}`, { itemId: item.id });
		return {
			ok: false,
			error: msg,
			finalPhase: item.currentPhase,
			transitionsApplied: this.transitionsApplied,
		};
	}
}

export async function autopilotRun(
	root: string,
	workflow: Workflow,
	item: Item,
): Promise<AutoPilotResult> {
	const pilot = new PhaseAutoPilot();
	return pilot.run(root, workflow, item);
}

export function canAutopilot(workflow: Workflow, item: Item): boolean {
	if (!item.currentPhase) return false;
	const phases = getStagePhases(workflow, item.stage);
	if (!phases) return false;
	const def = getPhaseDef(phases, item.currentPhase);
	if (!def) return false;
	return (def.transitions ?? []).some((t) => t.auto);
}
