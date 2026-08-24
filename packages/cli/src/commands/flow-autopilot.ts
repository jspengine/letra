import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, saveWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";
import { autopilotRun } from "../phases/autopilot.js";

export async function flowAutopilotAction(itemId: string): Promise<void> {
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

	console.log(chalk.cyan(`\n  ⏩ Auto-pilot starting for ${itemId}`));
	console.log(chalk.dim(`  Current phase: ${item.currentPhase || "(none)"}\n`));

	const result = await autopilotRun(root, workflow, item);
	saveWorkflow(root, workflow);

	if (result.ok) {
		console.log(`  ${chalk.green("✓")} Auto-pilot complete`);
		console.log(
			`  ${chalk.gray("Final phase:")} ${result.finalPhase || chalk.dim("(exited phase system)")}`,
		);
		console.log(`  ${chalk.gray("Transitions:")} ${result.transitionsApplied}`);
	} else {
		console.log(`  ${chalk.red("✗")} Auto-pilot stopped: ${result.error}`);
		console.log(`  ${chalk.gray("Stopped at:")} ${result.finalPhase || chalk.dim("(none)")}`);
		console.log(`  ${chalk.gray("Transitions:")} ${result.transitionsApplied}`);
	}
	console.log("");
}
