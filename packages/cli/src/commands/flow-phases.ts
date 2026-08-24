import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, saveWorkflow } from "../commands/flow-init.js";
import { logEntry } from "../session-log.js";
import { enterStage, transitionPhase, getStagePhases, getPhaseDef } from "../phases/engine.js";

export function flowPhasesAction(itemId: string): void {
	const root = resolve(process.cwd());
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}

	const item = workflow.items.find((i) => i.id === itemId);
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		return;
	}

	const phases = getStagePhases(workflow, item.stage);
	if (!phases) {
		console.log(chalk.yellow(`Stage "${item.stage}" has no phases defined`));
		return;
	}

	console.log(chalk.bold(`\n  Phases — ${item.id} (${item.stage})`));
	console.log(chalk.dim(`  Current: ${item.currentPhase || phases.initialState}\n`));

	for (const [id, def] of Object.entries(phases.states)) {
		const isCurrent = id === (item.currentPhase || phases.initialState);
		const prefix = isCurrent ? chalk.cyan(" > ") : "   ";
		console.log(`${prefix}${isCurrent ? chalk.cyan(id) : id} — ${def.label}`);
		if (def.description) {
			console.log(`     ${chalk.dim(def.description)}`);
		}
		if (isCurrent && def.transitions) {
			const targets = def.transitions
				.map(
					(t) =>
						`${t.target}${t.auto ? " (auto)" : ""}${t.gate ? ` [gate: ${t.gate}]` : ""}`,
				)
				.join(", ");
			console.log(`     ${chalk.dim(`→ ${targets}`)}`);
		}
	}
	console.log("");
}

export function flowPhaseTransitionAction(itemId: string, targetPhase: string): void {
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

	const result = transitionPhase(root, workflow, item, targetPhase);
	if (!result.ok) {
		console.log(chalk.red(result.error));
		return;
	}

	saveWorkflow(root, workflow);

	logEntry(root, "system", `phase_transition: ${item.id} → ${targetPhase}` as const);

	console.log(`  ${chalk.green("✓")} Phase transition: ${chalk.cyan(item.currentPhase || "")}`);
	if (result.triggeredActions && result.triggeredActions.length > 0) {
		console.log(`  ${chalk.gray("Actions:")} ${result.triggeredActions.join(", ")}`);
	}
	if (result.triggeredAutoTransition) {
		console.log(`  ${chalk.yellow("↻ Auto-transition triggered")}`);
	}
}
