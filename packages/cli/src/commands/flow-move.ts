import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { writeFocusFile } from "../adapters/focus-sync.js";
import { logEntry } from "../session-log.js";
import { queryLog } from "../session-log.js";
import { loadHarness, resolveHarnessRoot } from "../harness/loader.js";

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

export async function flowMove(root: string, itemId: string, targetStageInput: string, options?: { auto?: boolean; force?: boolean }): Promise<void> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}

	const item =
		workflow.items.find((i) => i.id.toLowerCase() === itemId.toLowerCase()) ||
		workflow.items.find((i) => i.description.toLowerCase() === itemId.toLowerCase());
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		process.exit(1);
	}

	// Auto-discovery: encontra próximo estágio por order ascendente
	if (options?.auto) {
		const currentStage = workflow.stages.find((s) => s.id === item.stage);
		if (!currentStage) {
			console.log(chalk.red(`Stage "${item.stage}" not found in workflow`));
			process.exit(1);
			return;
		}
		const nextStage = workflow.stages
			.filter((s) => s.order > currentStage.order)
			.sort((a, b) => a.order - b.order)[0];
		if (!nextStage) {
			console.log(chalk.yellow(`Item ${itemId} is already at the last stage (${currentStage.name})`));
			return;
		}
		targetStageInput = nextStage.id;

		// AC12: validate spec before moving
		if (!options?.force && item.spec) {
			const specFile = join(root, ".letra", "specs", item.spec, "spec.md");
			if (existsSync(specFile)) {
				const content = readFileSync(specFile, "utf-8");
				const pendingACs = content.match(/^- \[ \]/gm) || [];
				if (pendingACs.length > 0) {
					console.log(chalk.yellow(`⚠ Item ${itemId} has ${pendingACs.length} pending AC(s) in "${item.spec}"`));
					console.log(chalk.yellow(`  Use --force to move anyway, or complete ACs first.`));
					return;
				}
				// AC2.3: warn if ACs marked [x] but no ac_done log entry
				const doneACs = content.match(/^- \[[xX]\]/gm) || [];
				if (doneACs.length > 0) {
					const acLogEntries = queryLog(root, { itemId, action: "ac_done", limit: 999 });
					if (acLogEntries.length < doneACs.length) {
						console.log(chalk.yellow(`⚠ ${doneACs.length - acLogEntries.length} AC(s) marked [x] without "ac done" log entry.`));
						console.log(chalk.yellow(`  Run letra ac done <ID> for each completed AC.`));
					}
				}
			}
		}
	}

	// AC12: validate spec before moving (non-auto flows)
	if (!options?.auto && !options?.force && item.spec) {
		const specFile = join(root, ".letra", "specs", item.spec, "spec.md");
		if (existsSync(specFile)) {
			const content = readFileSync(specFile, "utf-8");
			const pendingACs = content.match(/^- \[ \]/gm) || [];
			if (pendingACs.length > 0) {
				console.log(chalk.yellow(`⚠ Item ${itemId} has ${pendingACs.length} pending AC(s) in "${item.spec}"`));
				console.log(chalk.yellow(`  Use --force to move anyway, or complete ACs first.`));
				return;
			}
			const doneACs = content.match(/^- \[[xX]\]/gm) || [];
			if (doneACs.length > 0) {
				const acLogEntries = queryLog(root, { itemId, action: "ac_done", limit: 999 });
				if (acLogEntries.length < doneACs.length) {
					console.log(chalk.yellow(`⚠ ${doneACs.length - acLogEntries.length} AC(s) marked [x] without "ac done" log entry.`));
					console.log(chalk.yellow(`  Run letra ac done <ID> for each completed AC.`));
				}
			}
		}
	}

	// Gate enforcement via harness (humano sempre bloqueia; automated avisa)
	{
		const harness = loadHarness(resolveHarnessRoot(root));
		const template = harness?.flows?.sdlc;
		if (template) {
			const targetDef = template.stages.find((s) => s.id === targetStageInput);
			if (targetDef?.gate) {
				const gateId = targetDef.gate.replace(/^.*[\\/]/, "").replace(/\.yaml$/, "");
				const gate = harness?.gates?.[gateId];
				if (gate?.type === "human" && gate.blocking) {
					const resolvedTarget = resolveStage(workflow, targetStageInput) || targetStageInput;
					console.log(chalk.red(`Gate bloqueante: ${gate.name}`));
					console.log(chalk.yellow(`  Aprovação humana necessária para entrar em "${resolvedTarget}".`));
					return;
				}
				if (gate?.type === "automated" && gate.blocking) {
					console.log(chalk.yellow(`⛔ Gate automated bloqueante: ${gate.name}`));
					console.log(chalk.yellow(`  Valide as condições antes de avançar.`));
					// TODO: implementar check automático
				}
			}
		}
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

	const targetStageIsDone = workflow.stages.find((s) => s.id === targetStageId)?.zone === "done";
	if (targetStageIsDone && item.claimedBy) {
		if (item.claimedBy === "opencode") {
			console.log(`  ${chalk.gray("Release automático:")} ${itemId} não está mais sob responsabilidade do agente`);
		}
		delete item.claimedBy;
		delete item.claimedAt;
	}

	const result = await writeWorkflow(root, {
		workflow,
		source: "flow-move",
		primaryItemId: itemId,
		skipSitrep: true,
	});

	if (item.spec) {
		writeFocusFile(root, item.spec, item.id);
	}

	logEntry(root, "item_move", `Item ${itemId} movido: ${fromStage} → ${toStage}`, {
		itemId,
		details: { from: item.stage, to: targetStageId },
	});

	console.log(
		`  ${chalk.green("✓")} Item ${chalk.cyan(itemId)} moved: ${chalk.yellow(fromStage)} → ${chalk.green(toStage)}`,
	);
	if (result.ok && result.filesUpdated.length > 0) {
		console.log(`  ${chalk.gray("Updated:")} ${result.filesUpdated.join(", ")}`);
	}
}

function normalizeItemId(input: string): string {
	if (/^ITEM-\d+$/i.test(input)) return input.toUpperCase();
	if (/^\d+$/.test(input)) return `ITEM-${input}`;
	console.log(chalk.red(`Invalid item ID: "${input}". Use a number (e.g. 34) or ITEM-N format.`));
	process.exit(1);
}

export function flowMoveAction(
	targetPath: string | undefined,
	itemId: string,
	options: { to?: string; auto?: boolean; force?: boolean },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	const normalized = normalizeItemId(itemId);
	if (options.auto) {
		flowMove(root, normalized, options.to || "", { auto: true, force: options.force });
	} else {
		flowMove(root, normalized, options.to || "", { force: options.force });
	}
}
