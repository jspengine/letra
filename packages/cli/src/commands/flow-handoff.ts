import { resolve } from "node:path";
import chalk from "chalk";
import { resolveCliActor } from "../identity/agent-runtime.js";
import { type Item, loadWorkflow } from "./flow-init.js";
import { loadHarness, resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "../harness/loader.js";
import {
	directionForOperation,
	directionForRunAwareOperation,
	requestHandoffOperation,
	rollbackHandoffOperation,
} from "../domain-operations/service.js";

const DEFAULT_HANDOFF_TTL_MINUTES = 30;

export interface HandoffOptions {
	to?: string;
	summary?: string;
	evidence?: string[];
	executor?: string;
	rollback?: boolean;
}

export async function handoffItem(
	root: string,
	itemId: string,
	options: HandoffOptions,
): Promise<void> {
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

	if (
		item.stage === "done" ||
		workflow.stages.find((s) => s.id === item.stage)?.zone === "done"
	) {
		console.log(chalk.red(`Cannot handoff ${itemId}: item is already completed`));
		process.exit(1);
	}

	if (options.rollback) {
		if (!item.handoff) {
			console.log(chalk.red(`Cannot rollback ${itemId}: no handoff found`));
			process.exit(1);
		}
		const previousFrom = item.handoff.from;
		const actor = resolveCliActor(root);
		const operation = await rollbackHandoffOperation(root, {
			itemId,
			actor,
			// The item's direction, as the operation compares it; the item-less
			// workspace direction has a different revision.
			expectedRevision: directionForOperation(root, { itemId }).revision,
			reason: options.summary ?? "Rollback solicitado pela CLI.",
		});
		if (operation.outcome !== "accepted") {
			console.log(chalk.red(`Cannot rollback: ${operation.reason}`));
			process.exit(1);
		}
		console.log(`  ${chalk.green("✓")} ${itemId} handoff rolled back to ${previousFrom}`);
		return;
	}

	if (!options.to) {
		console.log(chalk.red("Target agent is required (--to)"));
		process.exit(1);
	}

	if (!options.summary) {
		console.log(chalk.red("Summary is required (--summary)"));
		process.exit(1);
	}

	let ttlMinutes = DEFAULT_HANDOFF_TTL_MINUTES;
	try {
		const manifest = loadHarness(resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION));
		if (manifest) {
			const role = manifest.roles[options.to];
			if (role?.handoff?.ttlMinutes) {
				ttlMinutes = role.handoff.ttlMinutes;
			}
		}
	} catch {
		// fallback to default TTL
	}

	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

	const from = item.claimedBy;
	if (!from) {
		console.log(chalk.red("Cannot handoff: item has no active claim"));
		process.exit(1);
	}
	const executorId = options.executor ?? item.claimExecutorId ?? "cli";
	const operation = await requestHandoffOperation(root, {
		itemId,
		to: options.to,
		actor: from,
		executorId,
		summary: options.summary,
		evidence: options.evidence || [],
		ttlMinutes,
		// Handoff is a canonical passage: it compares the run-aware direction
		// of this item, not the item-less workspace direction.
		expectedRevision: directionForRunAwareOperation(root, { itemId, executorId }).revision,
		reason: options.summary,
	});
	if (operation.outcome !== "accepted") {
		console.log(chalk.red(`Cannot handoff: ${operation.reason}`));
		process.exit(1);
	}
	console.log(`  ${chalk.green("✓")} ${itemId} handoff: ${from} → ${options.to}`);
	console.log(`    ${chalk.dim(`Expires at: ${expiresAt.toISOString()}`)}`);
}

export async function handoffAction(
	targetPath: string | undefined,
	itemId: string,
	options: HandoffOptions,
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await handoffItem(root, itemId, options);
}
