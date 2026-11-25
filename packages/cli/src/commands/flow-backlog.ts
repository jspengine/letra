import { resolve } from "node:path";
import chalk from "chalk";
import { type Workflow, loadWorkflow } from "./flow-init.js";
import { resolveDirection } from "../agent-direction/service.js";
import { createItemOperation } from "../domain-operations/service.js";
import { resolveLocalIdentity } from "../identity/service.js";

function workflowExists(root: string): Workflow | null {
	return loadWorkflow(root);
}

export async function backlogAdd(root: string, description: string, spec?: string, requestedId?: string): Promise<void> {
	if (!description) {
		console.log(chalk.red("Description is required"));
		process.exit(1);
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

	const direction = resolveDirection(root);
	const operation = await createItemOperation(root, {
		id: requestedId,
		description,
		spec,
		expectedRevision: direction.revision,
		reason: "Criação de item pelo backlog da CLI.",
		actor: resolveLocalIdentity(root).id,
	});
	if (operation.outcome !== "accepted") {
		console.log(chalk.red(`  ${operation.reasonCode}: ${operation.reason}`));
		return;
	}
	const created = operation.createdItem;
	console.log(`  ${chalk.green("✓")} Item ${chalk.cyan(created?.id ?? requestedId ?? "criado")} added to ${chalk.cyan(workflow.stages[0].name)}`);
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

export function backlogActionAdd(
	targetPath: string | undefined,
	description: string,
	spec?: string,
	requestedId?: string,
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	return backlogAdd(root, description, spec, requestedId);
}

export function backlogActionList(targetPath: string | undefined): void {
	const root = resolve(process.cwd(), targetPath || ".");
	backlogList(root);
}
