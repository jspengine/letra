import { resolve } from "node:path";
import chalk from "chalk";
import { type Item, loadWorkflow, writeWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";
import { GateChecker } from "../harness/gate-checker.js";
import { loadHarness, resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "../harness/loader.js";

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
		item.claimedBy = previousFrom;
		item.claimedAt = new Date().toISOString();
		item.handoff = undefined;
		workflow.updatedAt = new Date().toISOString();
		writeWorkflow(root, {
			workflow,
			source: "flow-handoff-rollback",
			primaryItemId: item.id,
			skipSitrep: true,
		});
		logEntry(root, "handoff_rollback", `Handoff rolled back to ${previousFrom}`, {
			itemId: item.id,
			to: previousFrom,
			reason: options.summary,
		});
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

	const currentStage = workflow.stages.find((s) => s.id === item.stage);
	if (currentStage?.gate) {
		const gateChecker = new GateChecker(root);
		const gateResult = gateChecker.checkHandoffAllowed(currentStage.gate, item);
		if (!gateResult.allowed) {
			console.log(chalk.red(`Cannot handoff: ${gateResult.reason}`));
			process.exit(1);
		}
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

	item.handoff = {
		from: item.claimedBy || "unknown",
		to: options.to,
		summary: options.summary,
		evidence: options.evidence || [],
		timestamp: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
		executorId: options.executor,
	};

	workflow.updatedAt = now.toISOString();
	writeWorkflow(root, {
		workflow,
		source: "flow-handoff",
		primaryItemId: item.id,
		skipSitrep: true,
	});

	logEntry(root, "handoff", `Handoff from ${item.handoff.from} to ${options.to}`, {
		itemId: item.id,
		from: item.handoff.from,
		to: options.to,
		summary: options.summary,
		evidence: options.evidence,
		executorId: options.executor,
		expiresAt: expiresAt.toISOString(),
	});

	console.log(`  ${chalk.green("✓")} ${itemId} handoff: ${item.handoff.from} → ${options.to}`);
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
