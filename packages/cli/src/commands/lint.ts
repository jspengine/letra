import { existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import chalk from "chalk";
import { validateSpecStructure } from "../validation/structure.js";
import { getLetraDir } from "./../workspace/resolver.js";

export async function lint(targetPath?: string) {
	const root = resolve(process.cwd(), targetPath || ".");
	let specsDir = join(getLetraDir(root), "specs");

	if (!existsSync(specsDir)) {
		let found = false;
		let search = root;
		const fsRoot = resolve("/").replace(/\\/g, "/");
		while (search && search !== fsRoot && search !== dirname(search)) {
			const candidate = join(search, ".letra", "specs");
			if (existsSync(candidate)) {
				specsDir = candidate;
				found = true;
				break;
			}
			search = dirname(search);
		}
		if (!found) {
			console.log(chalk.red("Error: .letra/specs/ not found. Run 'letra init' first."));
			process.exit(1);
		}
	}

	let totalErrors = 0;
	let totalWarnings = 0;
	const results: { file: string; errors: string[]; warnings: string[] }[] = [];

	const entries = readdirSync(specsDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

		const specFile = join(specsDir, entry.name, "spec.md");
		const { errors, warnings } = validateSpecStructure(specFile);

		if (errors.length > 0 || warnings.length > 0) {
			results.push({ file: entry.name, errors, warnings });
			totalErrors += errors.length;
			totalWarnings += warnings.length;
		}
	}

	if (results.length === 0) {
		console.log(chalk.green("All specs are valid"));
		process.exit(0);
	}

	console.log("");
	for (const result of results) {
		console.log(chalk.bold(`\nSpec: ${result.file}`));
		for (const error of result.errors) {
			console.log(chalk.red(`  ✗ ${error}`));
		}
		for (const warning of result.warnings) {
			console.log(chalk.yellow(`  ⚠ ${warning}`));
		}
	}

	console.log(
		chalk.gray(
			`\n${results.length} spec(s) with issues: ${totalErrors} error(s), ${totalWarnings} warning(s)`,
		),
	);
	process.exit(totalErrors > 0 ? 1 : 0);
}
