import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { generateAdapters } from "../adapters/generate.js";
import { clearFocusFile, writeFocusFile } from "../adapters/focus-sync.js";
import { loadWorkflow } from "./flow-init.js";

export default function () {
	return new Command("focus")
		.argument("[spec]", "Spec name to focus on")
		.option("--clear", "Remove focus file")
		.action((spec: string | undefined, options: { clear?: boolean }) => {
			const root = resolve(process.cwd());
			const focusFile = join(root, ".letra", "focus.md");

			if (options.clear) {
				if (existsSync(focusFile)) {
					clearFocusFile(root);
					console.log(chalk.green("Focus removed."));
				} else {
					console.log(chalk.yellow("No focus to remove."));
				}

				const workflow = loadWorkflow(root);
				if (workflow) {
					const codeStage = workflow.stages.find(
						(s) => s.id === "code" || s.name.toLowerCase() === "code",
					);
					const activeStageId = codeStage ? codeStage.id : workflow.stages[0]?.id;

					generateAdapters(root, workflow.tools, {
						source: "focus",
						workflow: {
							name: workflow.name,
							stages: workflow.stages,
							items: workflow.items,
						},
						activeStageId,
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
				let activeStageId = "code";

				if (workflow) {
					const itemWithSpec = workflow.items.find((item) => item.spec === spec);
					if (itemWithSpec) {
						itemId = itemWithSpec.id;
						activeStageId = itemWithSpec.stage;
					} else {
						const codeStage = workflow.stages.find(
							(s) => s.id === "code" || s.name.toLowerCase() === "code",
						);
						activeStageId = codeStage ? codeStage.id : workflow.stages[0]?.id;
					}
				}

				writeFocusFile(root, spec, itemId);
				console.log(chalk.green(`Focus set to "${spec}".`));

				if (workflow) {
					generateAdapters(root, workflow.tools, {
						source: "focus",
						workflow: {
							name: workflow.name,
							stages: workflow.stages,
							items: workflow.items,
						},
						activeStageId,
						primaryItemId: itemId || undefined,
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
