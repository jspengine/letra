import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";

function ageLabel(createdAt: string): string {
	const created = new Date(createdAt);
	const age = Math.floor(
		(Date.now() - created.getTime()) / (1000 * 60 * 60 * 24),
	);
	return age === 0 ? "today" : `${age}d`;
}

export function flowBoard(root: string): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(
			chalk.yellow("No workflow found. Run 'letra flow init --quick' first"),
		);
		return;
	}

	console.log(`\n  ${chalk.bold("Board")} — ${chalk.cyan(workflow.name)}\n`);

	const stageMap = new Map(workflow.stages.map((s) => [s.id, s]));
	const itemsByStage = new Map<string, typeof workflow.items>();

	for (const stage of workflow.stages) {
		itemsByStage.set(stage.id, []);
	}

	for (const item of workflow.items) {
		const list = itemsByStage.get(item.stage);
		if (list) list.push(item);
	}

	for (const stage of workflow.stages) {
		const items = itemsByStage.get(stage.id) || [];
		const count = items.length;
		const countLabel =
			count === 0
				? chalk.gray("(empty)")
				: count === 1
					? chalk.white(`${count} item`)
					: chalk.white(`${count} items`);

		console.log(`  ${chalk.bold(stage.name)} ${countLabel}`);

		for (const item of items) {
			const desc =
				item.description.length > 50
					? `${item.description.slice(0, 49)}…`
					: item.description;
			console.log(
				`    ${chalk.cyan(item.id.padEnd(7))} ${desc} ${chalk.gray(ageLabel(item.createdAt))}`,
			);
		}

		if (items.length > 0) console.log("");
	}
}

export function flowBoardAction(targetPath: string | undefined): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowBoard(root);
}
