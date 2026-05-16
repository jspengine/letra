import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";

function extractOutcome(specDir: string): string | null {
	const specFile = join(specDir, "spec.md");
	if (!existsSync(specFile)) return null;
	const content = readFileSync(specFile, "utf-8");
	const match = content.match(/## Outcome\s+([\s\S]*?)(?=\n## |\n*$)/);
	return match ? match[1].trim() : null;
}

export default function () {
	return new Command("focus")
		.argument("[spec]", "Spec name to focus on")
		.option("--clear", "Remove focus file")
		.action((spec: string | undefined, options: { clear?: boolean }) => {
			const root = resolve(process.cwd());
			const focusFile = join(root, ".letra", "focus.md");

			if (options.clear) {
				if (existsSync(focusFile)) {
					unlinkSync(focusFile);
					console.log(chalk.green("Focus removed."));
				} else {
					console.log(chalk.yellow("No focus to remove."));
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

				const outcome = extractOutcome(specDir);
				const outcomeLine = `**Outcome**: ${outcome || spec}`;
				const focusContent = [
					`# Focus: ${spec}`,
					"",
					`**Path**: .letra/specs/${spec}/`,
					outcomeLine,
					"",
				].join("\n");

				writeFileSync(focusFile, focusContent);
				console.log(chalk.green(`Focus set to "${spec}".`));
				return;
			}

			if (existsSync(focusFile)) {
				console.log(readFileSync(focusFile, "utf-8"));
			} else {
				console.log("Nenhum foco definido.");
			}
		});
}
