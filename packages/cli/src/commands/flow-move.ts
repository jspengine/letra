import { resolve } from "node:path";
import chalk from "chalk";
import { generateAdapters } from "../adapters/generate.js";
import { writeFocusFile } from "../adapters/focus-sync.js";
import { loadWorkflow, saveWorkflow } from "./flow-init.js";

function now(): string {
	return new Date().toISOString();
}

function resolveStage(
	workflow: { stages: Array<{ id: string; name: string }> },
	input: string,
): string | null {
	const lower = input.toLowerCase();
	for (const stage of workflow.stages) {
		if (stage.id === lower) return stage.id;
		if (stage.name.toLowerCase() === lower) return stage.id;
	}
	return null;
}

export function flowMove(root: string, itemId: string, targetStageInput: string): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}

	const item =
		workflow.items.find((i) => i.id === itemId) ||
		workflow.items.find((i) => i.description === itemId);
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		process.exit(1);
	}

	const targetStageId = resolveStage(workflow, targetStageInput);
	if (!targetStageId) {
		const valid = workflow.stages.map((s) => `${s.id} (${s.name})`).join(", ");
		console.log(chalk.red(`Stage "${targetStageInput}" not found. Valid stages: ${valid}`));
		process.exit(1);
	}

	if (item.stage === targetStageId) {
		console.log(chalk.yellow(`Item ${itemId} is already in stage "${targetStageId}"`));
		return;
	}

	const fromStage = workflow.stages.find((s) => s.id === item.stage)?.name || item.stage;
	const toStage = workflow.stages.find((s) => s.id === targetStageId)?.name || targetStageId;

	item.stage = targetStageId;
	workflow.updatedAt = now();
	saveWorkflow(root, workflow);

	if (item.spec) {
		writeFocusFile(root, item.spec, item.id);
	}

	generateAdapters(root, workflow.tools, {
		source: "flow-move",
		workflow: {
			name: workflow.name,
			stages: workflow.stages,
			items: workflow.items,
		},
		activeStageId: targetStageId,
		primaryItemId: item.id,
	});

	console.log(
		`  ${chalk.green("✓")} Item ${chalk.cyan(itemId)} moved: ${chalk.yellow(fromStage)} → ${chalk.green(toStage)}`,
	);
	console.log(`  ${chalk.gray("Adapters regenerated for:")} ${workflow.tools.join(", ")}`);
}

export function flowMoveAction(
	targetPath: string | undefined,
	itemId: string,
	options: { to: string },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowMove(root, itemId, options.to);
}
