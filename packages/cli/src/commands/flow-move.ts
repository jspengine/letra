import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { logEntry, queryLog } from "../session-log.js";
import { enterStage } from "../phases/engine.js";
import { autopilotRun, canAutopilot } from "../phases/autopilot.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import { GateChecker } from "../harness/gate-checker.js";
import { getLetraDir } from "./../workspace/resolver.js";

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

export async function flowMove(
	root: string,
	itemId: string,
	targetStageInput: string,
	options?: { auto?: boolean; force?: boolean },
): Promise<void> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}

	const item =
		workflow.items.find((i) => i.id === itemId) ||
		workflow.items.find((i) => i.id.toLowerCase() === itemId.toLowerCase()) ||
		workflow.items.find((i) => i.description.toLowerCase() === itemId.toLowerCase());
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		process.exit(1);
	}

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
			console.log(
				chalk.yellow(`Item ${itemId} is already at the last stage (${currentStage.name})`),
			);
			return;
		}
		targetStageInput = nextStage.id;

		if (!options?.force && item.spec) {
			const specFile = join(getLetraDir(root), "specs", item.spec, "spec.md");
			if (existsSync(specFile)) {
				const content = readFileSync(specFile, "utf-8");
				const pendingACs = content.match(/^- \[ \]/gm) || [];
				if (pendingACs.length > 0) {
					console.log(
						chalk.yellow(
							`⚠ Item ${itemId} has ${pendingACs.length} pending AC(s) in "${item.spec}"`,
						),
					);
					console.log(
						chalk.yellow("  Use --force to move anyway, or complete ACs first."),
					);
					return;
				}
				const doneACs = content.match(/^- \[[xX]\]/gm) || [];
				if (doneACs.length > 0) {
					const acLogEntries = queryLog(root, { itemId, action: "ac_done", limit: 999 });
					if (acLogEntries.length < doneACs.length) {
						console.log(
							chalk.yellow(
								`⚠ ${doneACs.length - acLogEntries.length} AC(s) marked [x] without "ac done" log entry.`,
							),
						);
						console.log(
							chalk.yellow("  Run letra ac done <ID> for each completed AC."),
						);
					}
				}
			}
		}
	}

	if (!options?.auto && !options?.force && item.spec) {
		const specFile = join(getLetraDir(root), "specs", item.spec, "spec.md");
		if (existsSync(specFile)) {
			const content = readFileSync(specFile, "utf-8");
			const pendingACs = content.match(/^- \[ \]/gm) || [];
			if (pendingACs.length > 0) {
				console.log(
					chalk.yellow(
						`⚠ Item ${itemId} has ${pendingACs.length} pending AC(s) in "${item.spec}"`,
					),
				);
				console.log(chalk.yellow("  Use --force to move anyway, or complete ACs first."));
				return;
			}
			const doneACs = content.match(/^- \[[xX]\]/gm) || [];
			if (doneACs.length > 0) {
				const acLogEntries = queryLog(root, { itemId, action: "ac_done", limit: 999 });
				if (acLogEntries.length < doneACs.length) {
					console.log(
						chalk.yellow(
							`⚠ ${doneACs.length - acLogEntries.length} AC(s) marked [x] without "ac done" log entry.`,
						),
					);
					console.log(chalk.yellow("  Run letra ac done <ID> for each completed AC."));
				}
			}
		}
	}

	{
		const resolved = resolveActiveFlow(root);
		const targetDef = resolved.flow?.stages.find((stage) => stage.id === targetStageInput);
		const gate = targetDef?.gate;
		if (gate?.blocking) {
			if (gate.type === "human") {
				if (options?.force) {
					console.log(chalk.yellow(`  Gate "${gate.name}" bypassado via --force`));
				} else {
					const resolvedTarget =
						resolveStage(workflow, targetStageInput) || targetStageInput;
					console.log(chalk.red(`Gate bloqueante: ${gate.name}`));
					console.log(
						chalk.yellow(
							`  Aprovação humana necessária para entrar em "${resolvedTarget}".`,
						),
					);
					return;
				}
			} else {
				const checker = new GateChecker(root);
				const result = checker.check(gate.id, item);
				if (!result.allowed) {
					const resolvedTarget =
						resolveStage(workflow, targetStageInput) || targetStageInput;
					console.log(chalk.red(`Gate bloqueante: ${gate.name}`));
					console.log(chalk.yellow(`  ${result.reason}`));
					console.log(
						chalk.yellow(
							`  Aprovação humana necessária para entrar em "${resolvedTarget}".`,
						),
					);
					return;
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
	const phaseResult = enterStage(workflow, item);
	if (phaseResult.phase) {
		logEntry(root, "system", `phase_entry: ${item.id} → ${phaseResult.phase}` as const);
	}
	workflow.updatedAt = now();

	if (phaseResult.ok && item.currentPhase && canAutopilot(workflow, item)) {
		console.log(
			`  ${chalk.cyan("⏩")} Auto-pilot disponível para ${item.id} (fase inicial tem auto-transition)`,
		);
		const pilotResult = await autopilotRun(root, workflow, item);
		if (pilotResult.ok) {
			console.log(
				`  ${chalk.green("✓")} Auto-pilot: ${pilotResult.transitionsApplied} transição(ões) — parou em "${pilotResult.finalPhase || "__EXIT__"}"`,
			);
		} else {
			console.log(
				`  ${chalk.yellow("⏸")} Auto-pilot: ${pilotResult.error} — parou em "${pilotResult.finalPhase}"`,
			);
		}
	}

	const targetStageIsDone = workflow.stages.find((s) => s.id === targetStageId)?.zone === "done";
	if (targetStageIsDone && item.claimedBy) {
		if (item.claimedBy === "opencode") {
			console.log(
				`  ${chalk.gray("Release automático:")} ${itemId} não está mais sob responsabilidade do agente`,
			);
		}
		item.claimedBy = undefined;
		item.claimedAt = undefined;
	}

	const result = await writeWorkflow(root, {
		workflow,
		source: "flow-move",
		primaryItemId: itemId,
		skipSitrep: true,
	});

	if (item.spec) {
		writeFocusWithRecommendations(root, item.spec, item.id);
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
