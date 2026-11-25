import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";
import {
	directionForRunAwareOperation,
	requestPassageOperation,
} from "../domain-operations/service.js";
import { resolveCliActor } from "../identity/agent-runtime.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";

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
	options?: { auto?: boolean; force?: boolean; actor?: string; reason?: string; run?: string },
): Promise<boolean> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		return false;
	}
	const item = workflow.items.find((candidate) =>
		candidate.id === itemId || candidate.id.toLowerCase() === itemId.toLowerCase() || candidate.description.toLowerCase() === itemId.toLowerCase());
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		return false;
	}
	if (options?.auto) {
		const current = workflow.stages.find((stage) => stage.id === item.stage);
		if (!current) {
			console.log(chalk.red(`Stage "${item.stage}" not found in workflow`));
			return false;
		}
		const next = workflow.stages.filter((stage) => stage.order > current.order).sort((a, b) => a.order - b.order)[0];
		if (!next) {
			console.log(chalk.yellow(`Item ${itemId} is already at the last stage (${current.name})`));
			return false;
		}
		targetStageInput = next.id;
	}
	const targetStageId = resolveStage(workflow, targetStageInput);
	if (!targetStageId) {
		console.log(chalk.red(`Stage "${targetStageInput}" not found`));
		return false;
	}
	if (item.stage === targetStageId) {
		// Idempotent: the requested state already holds, so this is not a refusal.
		console.log(chalk.yellow(`Item ${itemId} is already in stage "${targetStageId}"`));
		return true;
	}
	const fromStage = workflow.stages.find((stage) => stage.id === item.stage)?.name ?? item.stage;
	const toStage = workflow.stages.find((stage) => stage.id === targetStageId)?.name ?? targetStageId;
	if (!item.claimExecutorId) {
		console.log(chalk.red(`Cannot move ${itemId}: item não possui claim ativa; adquira uma claim antes da passagem.`));
		return false;
	}
	const activeFlow = resolveActiveFlow(root, { itemId: item.id, workflowVersionId: item.workflowVersionId }).flow;
	const destination = activeFlow?.stages.find((stage) => stage.id === targetStageId);
	const recipients = destination?.roleIds?.length ? destination.roleIds : destination?.agents ?? [];
	if (!recipients.length) {
		console.log(chalk.red(`Cannot move ${itemId}: estágio ${targetStageId} sem papel/destinatário configurado.`));
		return false;
	}
	if (recipients.length > 1) {
		console.log(chalk.red(`Cannot move ${itemId}: múltiplos destinatários configurados (${recipients.join(", ")}); escolha explícita ainda não está disponível neste comando.`));
		return false;
	}
	const operation = await requestPassageOperation(root, {
		itemId,
		targetStageId,
		runId: options?.run,
		to: recipients[0],
		executorId: item.claimExecutorId,
		summary: `Passagem solicitada pela CLI: ${fromStage} → ${toStage}.`,
		evidence: [],
		actor: resolveCliActor(root, options?.actor),
		// The revision requestPassageOperation compares (run-aware, bound to
		// the claim's executor); resolveAgentDirection diverges once a Run exists.
		expectedRevision: directionForRunAwareOperation(root, {
			itemId: item.id,
			runId: options?.run,
			executorId: item.claimExecutorId,
		}).revision,
		reason: options?.reason?.trim() || `Transição solicitada pela CLI: ${fromStage} → ${toStage}.`,
	});
	if (operation.outcome === "approval-required") {
		// Not a refusal: the passage was accepted and now waits for a human gate.
		console.log(chalk.yellow(`Passagem de ${itemId} aguarda aprovação humana [${operation.reasonCode}]: ${operation.reason}`));
		return true;
	}
	if (operation.outcome !== "accepted") {
		console.log(chalk.red(`Cannot move ${itemId} [${operation.reasonCode}]: ${operation.reason}${operation.recoveryActions?.length ? `\nRecuperação: ${operation.recoveryActions.join("; ")}` : ""}`));
		if (operation.nextCommand)
			console.log(`${operation.humanRequired ? "Próximo passo é humano; para diagnóstico" : "Próximo comando"}: ${operation.nextCommand}`);
		return false;
	}
	console.log(`  ${chalk.green("✓")} Item ${chalk.cyan(itemId)} moved: ${chalk.yellow(fromStage)} → ${chalk.green(toStage)}`);
	return true;
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
	options: { to?: string; auto?: boolean; force?: boolean; actor?: string; reason?: string; run?: string },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	// ITEM-25: the exit code is the only signal a script reads; a refused or
	// crashed passage must not look like success.
	return flowMove(root, normalizeItemId(itemId), options.to || "", options).then(
		(moved) => {
			if (!moved) process.exitCode = 1;
		},
		(error: unknown) => {
			console.log(chalk.red(`Cannot move ${itemId}: ${error instanceof Error ? error.message : String(error)}`));
			process.exitCode = 1;
		},
	);
}
