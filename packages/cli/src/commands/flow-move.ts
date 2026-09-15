import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";
import { requestTransitionOperation } from "../domain-operations/service.js";
import { resolveAgentDirection } from "../agent-direction/service.js";

function resolveStage(
	workflow: { stages: Array<{ id: string; name: string }> },
	input: string,
): string | null {
	const lower = input.toLowerCase();
	return workflow.stages.find((stage) => stage.id === lower || stage.name.toLowerCase() === lower)?.id ?? null;
}

export async function flowMove(
	root: string,
	itemId: string,
	targetStageInput: string,
	options?: { auto?: boolean; force?: boolean },
): Promise<void> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}
	const item = workflow.items.find((candidate) =>
		candidate.id === itemId || candidate.id.toLowerCase() === itemId.toLowerCase() || candidate.description.toLowerCase() === itemId.toLowerCase());
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		return;
	}
	if (options?.auto) {
		const current = workflow.stages.find((stage) => stage.id === item.stage);
		if (!current) {
			console.log(chalk.red(`Stage "${item.stage}" not found in workflow`));
			return;
		}
		const next = workflow.stages.filter((stage) => stage.order > current.order).sort((a, b) => a.order - b.order)[0];
		if (!next) {
			console.log(chalk.yellow(`Item ${itemId} is already at the last stage (${current.name})`));
			return;
		}
		targetStageInput = next.id;
	}
	const targetStageId = resolveStage(workflow, targetStageInput);
	if (!targetStageId) {
		console.log(chalk.red(`Stage "${targetStageInput}" not found`));
		return;
	}
	if (item.stage === targetStageId) {
		console.log(chalk.yellow(`Item ${itemId} is already in stage "${targetStageId}"`));
		return;
	}
	const fromStage = workflow.stages.find((stage) => stage.id === item.stage)?.name ?? item.stage;
	const toStage = workflow.stages.find((stage) => stage.id === targetStageId)?.name ?? targetStageId;
	const operation = await requestTransitionOperation(root, {
		itemId,
		targetStageId,
		actor: "human:cli",
		expectedRevision: resolveAgentDirection(root).revision,
		reason: `Transição solicitada pela CLI: ${fromStage} → ${toStage}.`,
	});
	if (operation.outcome !== "accepted") {
		console.log(chalk.red(`Cannot move ${itemId}: ${operation.reason}`));
		return;
	}
	console.log(`  ${chalk.green("✓")} Item ${chalk.cyan(itemId)} moved: ${chalk.yellow(fromStage)} → ${chalk.green(toStage)}`);
}

function normalizeItemId(input: string): string {
	if (/^ITEM-\d+$/i.test(input)) return input.toUpperCase();
	if (/^\d+$/.test(input)) return `ITEM-${input}`;
	console.log(chalk.red(`Invalid item ID: "${input}". Use a number (e.g. 34) or ITEM-N format.`));
	return input;
}

export function flowMoveAction(
	targetPath: string | undefined,
	itemId: string,
	options: { to?: string; auto?: boolean; force?: boolean },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	void flowMove(root, normalizeItemId(itemId), options.to || "", options);
}
