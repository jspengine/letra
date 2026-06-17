import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";

function ageLabel(createdAt: string): string {
	const created = new Date(createdAt);
	const age = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
	return age === 0 ? "today" : `${age}d`;
}

export function flowBoard(root: string): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}

	console.log(`\n  ${chalk.bold("Board")} — ${chalk.cyan(workflow.name)}\n`);

	if (workflow.items.length === 0) {
		console.log(`  ${chalk.gray("Nenhum item no board. Adicione via:")}`);
		console.log(`    ${chalk.cyan("letra flow backlog add <desc>")}\n`);
	}

	// Load health alerts for badge display
	const healthPath = join(root, ".letra", "health-record.json");
	let itemAlerts = new Map<string, number>();
	try {
		if (existsSync(healthPath)) {
			const health = JSON.parse(readFileSync(healthPath, "utf-8"));
			const entries = health.entries || [];
			for (const entry of entries) {
				if (entry.status !== "novo") continue;
				const match = entry.id.match(/_([A-Z]+-\d+)_/);
				if (match) {
					const itemId = match[1];
					itemAlerts.set(itemId, (itemAlerts.get(itemId) || 0) + 1);
				}
			}
		}
	} catch {
		// Silently ignore health record errors
	}

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

		const backlogStageIds = new Set(
				workflow.stages
					.filter((s) => s.zone === "todo" || s.id === "backlog")
					.map((s) => s.id),
			);

		for (const item of items) {
			const desc =
				item.description.length > 50
					? `${item.description.slice(0, 49)}…`
					: item.description;
			const claimIcon = item.claimedBy ? chalk.cyan("🤖") : "";

			let specInfo = "";
			if (item.spec) {
				const specLink = workflow.specLinks?.[item.spec];
				if (specLink) {
					const specPath = join(root, specLink.path);
					specInfo = existsSync(specPath) ? chalk.cyan(`📎${item.spec}`) : chalk.red(`⚠spec?`);
				} else {
					specInfo = chalk.red(`⚠reg?`);
				}
			} else if (!backlogStageIds.has(item.stage)) {
				specInfo = chalk.yellow("⚠sem");
			}

			const alertCount = itemAlerts.get(item.id) || 0;
			const alertBadge = alertCount > 0 ? chalk.red(` ⚠${alertCount}`) : "";

			console.log(
				`    ${chalk.cyan(item.id.padEnd(7))} ${desc} ${claimIcon}${specInfo}${alertBadge} ${chalk.gray(ageLabel(item.createdAt))}`,
			);
		}

		if (items.length > 0) console.log("");
	}
}

export function flowBoardAction(targetPath: string | undefined): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowBoard(root);
}
