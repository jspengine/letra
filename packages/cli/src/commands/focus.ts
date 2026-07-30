import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { clearFocusFile } from "../adapters/focus-sync.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";

export default function () {
	return new Command("focus")
		.argument("[spec]", "Spec name to focus on")
		.option("--claim", "Also claim the item (set claimedBy)")
		.option("--clear", "Remove focus file")
		.action(async (spec: string | undefined, options: { clear?: boolean; claim?: boolean }) => {
			const root = resolve(process.cwd());
			const focusFile = join(root, ".letra", "focus.md");

			if (options.clear) {
				if (existsSync(focusFile)) {
					clearFocusFile(root);
					logEntry(root, "focus_set", "Foco removido");
					console.log(chalk.green("Focus removed."));
				} else {
					console.log(chalk.yellow("No focus to remove."));
				}

				const workflow = loadWorkflow(root);
				if (workflow) {
					let releasedCount = 0;
					for (const item of workflow.items) {
						if (item.claimedBy) {
							logEntry(root, "item_release", `Auto-release on focus clear: ${item.id}`, { itemId: item.id });
							delete item.claimedBy;
							delete item.claimedAt;
							releasedCount++;
						}
					}
					if (releasedCount > 0) {
						console.log(chalk.gray(`  Released ${releasedCount} item(s).`));
					}
					await writeWorkflow(root, {
						workflow,
						source: "focus",
						skipSitrep: true,
						quiet: true,
					});
				}
				return;
			}

			if (spec) {
				const specDir = join(root, ".letra", "specs", spec);
				const specFile = join(specDir, "spec.md");

				if (!existsSync(specFile)) {
					console.log(chalk.red(`Spec "${spec}" not found`));
					process.exit(1);
				}

				const workflow = loadWorkflow(root);
				let itemId = "";
				let activeStageId = "";

				if (workflow) {
					const itemWithSpec = workflow.items.find((item) => item.spec === spec);
					if (itemWithSpec) {
						itemId = itemWithSpec.id;
						activeStageId = itemWithSpec.stage;
					} else {
						const devStage = workflow.stages.find((s) => s.zone === "doing")
							?? workflow.stages.find((s) => s.order > 0 && s.zone !== "done")
							?? workflow.stages[0];
						activeStageId = devStage?.id ?? workflow.stages[0]?.id;
					}
				}

				if (options.claim && workflow && itemId) {
					const itemWithSpec = workflow.items.find((item) => item.spec === spec);
					if (itemWithSpec && itemWithSpec.id === itemId) {
						for (const other of workflow.items) {
							if (other.claimedBy === "opencode" && other.id !== itemId) {
								logEntry(root, "item_release", `Auto-release on refocus: ${other.id}`, { itemId: other.id });
								delete other.claimedBy;
								delete other.claimedAt;
							}
						}
						itemWithSpec.claimedBy = "opencode";
						itemWithSpec.claimedAt = new Date().toISOString();
						console.log(chalk.gray(`  Claimed ${itemId}.`));
						logEntry(root, "item_claim", `Auto-claim: ${itemId}`, { itemId, by: "opencode" });
					}
				}

				writeFocusWithRecommendations(root, spec, itemId);
				logEntry(root, "focus_set", `Foco definido: ${spec}`, { itemId });
				console.log(chalk.green(`Focus set to "${spec}".`));

				if (workflow) {
					await writeWorkflow(root, {
						workflow,
						source: "focus",
						primaryItemId: itemId || undefined,
						skipSitrep: true,
						quiet: true,
					});
				}
				return;
			}

			if (existsSync(focusFile)) {
				console.log(readFileSync(focusFile, "utf-8"));
			} else {
				console.log("Nenhum foco definido.");
			}
		});
}
