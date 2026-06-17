import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import { type Item, type Workflow, loadWorkflow, writeWorkflow } from "./flow-init.js";

function now(): string {
	return new Date().toISOString();
}

function nextItemId(workflow: Workflow): string {
	let max = 0;
	for (const item of workflow.items) {
		const match = item.id.match(/^ITEM-(\d+)$/);
		if (match) {
			const num = Number.parseInt(match[1], 10);
			if (num > max) max = num;
		}
	}
	return `ITEM-${max + 1}`;
}

function workflowExists(root: string): Workflow | null {
	return loadWorkflow(root);
}

export function backlogAdd(root: string, description: string, spec?: string): void {
	if (!description) {
		console.log(chalk.red("Description is required"));
		process.exit(1);
	}

	if (spec) {
		const specsDir = join(root, ".letra", "specs", spec);
		if (!existsSync(specsDir)) {
			console.log(chalk.red(`Spec "${spec}" not found at .letra/specs/${spec}/`));
			return;
		}
	}

	const workflow = workflowExists(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}

	if (workflow.stages.length === 0) {
		console.log(chalk.red("Workflow has no stages defined"));
		process.exit(1);
	}

	const firstStage = workflow.stages[0].id;

	const item: Item = {
		id: nextItemId(workflow),
		description,
		stage: firstStage,
		createdAt: now(),
		spec: spec || undefined,
	};

	if (spec) {
		if (!workflow.specLinks) workflow.specLinks = {};
		if (!workflow.specLinks[spec]) {
			workflow.specLinks[spec] = { path: `.letra/specs/${spec}/spec.md` };
		}
	}

	workflow.items.push(item);
	workflow.updatedAt = now();
	writeWorkflow(root, { workflow, source: "flow-backlog", primaryItemId: item.id, skipSitrep: true });

	console.log(
		`  ${chalk.green("✓")} Item ${chalk.cyan(item.id)} added to ${chalk.cyan(workflow.stages[0].name)}`,
	);
}

export function backlogList(root: string): void {
	const workflow = workflowExists(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}

	if (workflow.items.length === 0) {
		console.log(chalk.yellow("No items in backlog"));
		return;
	}

	const stageNames = new Map(workflow.stages.map((s) => [s.id, s.name]));

	console.log("");
	console.log(
			`  ${chalk.bold("ID")}       ${chalk.bold("Description".padEnd(30))} ${chalk.bold("Stage".padEnd(15))} ${chalk.bold("Age")}`,
		);
		console.log(`  ${"─".repeat(75)}`);

		for (const item of workflow.items) {
		const stageName = stageNames.get(item.stage) || item.stage;
		const created = new Date(item.createdAt);
		const age = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
		const ageStr = age === 0 ? "today" : `${age}d`;

		const desc =
			item.description.length > 28
				? `${item.description.slice(0, 27)}…`
				: item.description.padEnd(30);

		const claimIcon = item.claimedBy ? "🤖" : "  ";
		console.log(
			`  ${chalk.cyan(item.id.padEnd(7))} ${desc} ${claimIcon} ${chalk.yellow(stageName.padEnd(15))} ${chalk.gray(ageStr)}`,
		);
	}
	console.log("");
}

export function backlogActionAdd(targetPath: string | undefined, description: string, spec?: string): void {
	const root = resolve(process.cwd(), targetPath || ".");
	backlogAdd(root, description, spec);
}

export function backlogActionList(targetPath: string | undefined): void {
	const root = resolve(process.cwd(), targetPath || ".");
	backlogList(root);
}
