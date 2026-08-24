import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, saveWorkflow } from "./flow-init.js";
import { getStagePhases, getPhaseDef } from "../phases/engine.js";
import { PhaseActionRunner } from "../phases/runner.js";
import { logEntry } from "../session-log.js";

const runner = new PhaseActionRunner();

export function flowPhaseRunAction(itemId: string): void {
	const root = resolve(process.cwd());
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found"));
		return;
	}

	const item = workflow.items.find((i) => i.id === itemId);
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		return;
	}

	if (!item.currentPhase) {
		console.log(chalk.yellow(`Item ${itemId} has no current phase`));
		return;
	}

	const phases = getStagePhases(workflow, item.stage);
	if (!phases) {
		console.log(chalk.yellow(`Stage "${item.stage}" has no phases defined`));
		return;
	}

	const phaseDef = getPhaseDef(phases, item.currentPhase);
	if (!phaseDef) {
		console.log(chalk.red(`Phase "${item.currentPhase}" not found in stage "${item.stage}"`));
		return;
	}

	if (!phaseDef.actions || phaseDef.actions.length === 0) {
		console.log(chalk.yellow(`Phase "${phaseDef.label}" has no actions to run`));
		return;
	}

	console.log(chalk.cyan(`\n  ▶ Running actions for ${item.id} — ${phaseDef.label}\n`));

	const result = runner.execPhase(root, item, phaseDef);
	saveWorkflow(root, workflow);

	if (result.ok) {
		console.log(`  ${chalk.green("✓")} All actions completed`);
		for (const a of result.actions) {
			console.log(`    ${chalk.gray("→")} ${a}`);
		}
	} else {
		console.log(`  ${chalk.red("✗")} Action failed: ${result.error}`);
		for (const a of result.actions) {
			console.log(`    ${chalk.gray("→")} ${a}`);
		}
		logEntry(root, "system", `phase-run:${itemId} failed — ${result.error}`, {
			itemId,
			details: { phase: item.currentPhase },
		});
	}
	console.log("");
}
