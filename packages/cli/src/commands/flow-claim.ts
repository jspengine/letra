import { createInterface } from "node:readline";
import { resolve } from "node:path";
import chalk from "chalk";
import { type Item, loadWorkflow, writeWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";

function askYesNo(query: string): Promise<boolean> {
	if (!process.stdin.isTTY) return Promise.resolve(true);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(`${chalk.yellow(query)} (y/N) `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y");
		});
	});
}

export async function claimItem(root: string, itemId: string): Promise<void> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found"));
		process.exit(1);
	}

	const item = workflow.items.find((i: Item) => i.id === itemId);
	if (!item) {
		console.log(chalk.red(`Item ${itemId} not found`));
		process.exit(1);
	}

	if (item.stage === "done" || workflow.stages.find((s) => s.id === item.stage)?.zone === "done") {
		console.log(chalk.red(`Cannot claim ${itemId}: item is already completed`));
		process.exit(1);
	}

	if (item.claimedBy) {
		if (item.claimedBy === "opencode") {
			console.log(chalk.yellow(`${itemId} is already under your responsibility`));
			return;
		}
		const ok = await askYesNo(`${itemId} is claimed by "${item.claimedBy}". Overwrite?`);
		if (!ok) {
			console.log(chalk.dim("Claim cancelled"));
			return;
		}
	}

	item.claimedBy = "opencode";
	item.claimedAt = new Date().toISOString();
	workflow.updatedAt = new Date().toISOString();

	writeWorkflow(root, { workflow, source: "flow-claim", primaryItemId: item.id, skipSitrep: true });
	logEntry(root, "item_claim", "claimed by opencode", { itemId: item.id });

	console.log(`  ${chalk.green("✓")} ${itemId} claimed`);
}

export async function releaseItem(root: string, options?: { item?: string }): Promise<void> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found"));
		process.exit(1);
	}

	if (options?.item) {
		const item = workflow.items.find((i: Item) => i.id === options.item);
		if (!item) {
			console.log(chalk.red(`Item ${options.item} not found`));
			process.exit(1);
		}
		if (!item.claimedBy) {
			console.log(chalk.yellow(`${options.item} is not claimed`));
			return;
		}
		if (item.claimedBy !== "opencode") {
			const ok = await askYesNo(`${options.item} is claimed by "${item.claimedBy}". Release anyway?`);
			if (!ok) {
				console.log(chalk.dim("Release cancelled"));
				return;
			}
		}
		delete item.claimedBy;
		delete item.claimedAt;
		workflow.updatedAt = new Date().toISOString();
		writeWorkflow(root, { workflow, source: "flow-release", primaryItemId: item.id, skipSitrep: true });
		logEntry(root, "item_release", "released by opencode", { itemId: item.id });
		console.log(`  ${chalk.green("✓")} ${options.item} released`);
		return;
	}

	const claimed = workflow.items.filter((i: Item) => i.claimedBy === "opencode");
	if (claimed.length === 0) {
		console.log(chalk.yellow("No items currently claimed by opencode"));
		return;
	}

	for (const item of claimed) {
		delete item.claimedBy;
		delete item.claimedAt;
		logEntry(root, "item_release", "released by opencode (batch)", { itemId: item.id });
	}
	workflow.updatedAt = new Date().toISOString();
	writeWorkflow(root, { workflow, source: "flow-release", skipSitrep: true });

	console.log(`  ${chalk.green("✓")} Released ${claimed.length} item(s)`);
}

export async function claimAction(targetPath: string | undefined, itemId: string): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await claimItem(root, itemId);
}

export async function releaseAction(targetPath: string | undefined, options?: { item?: string }): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await releaseItem(root, options);
}
