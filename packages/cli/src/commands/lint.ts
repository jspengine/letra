import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";

const REQUIRED_SECTIONS = [
	"## Outcome",
	"## Constraints",
	"## Exclusions",
	"## Acceptance Criteria",
	"## Context",
];

interface LintResult {
	file: string;
	errors: string[];
	warnings: string[];
}

export async function lint(targetPath?: string) {
	const root = resolve(process.cwd(), targetPath || ".");
	const specsDir = join(root, ".letra", "specs");

	if (!existsSync(specsDir)) {
		console.log(
			chalk.red("Error: .letra/specs/ not found. Run 'letra init' first."),
		);
		process.exit(1);
	}

	const results: LintResult[] = [];
	let totalErrors = 0;
	let totalWarnings = 0;

	const entries = readdirSync(specsDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

		const specFile = join(specsDir, entry.name, "spec.md");
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!existsSync(specFile)) {
			errors.push("Missing spec.md");
		} else {
			const content = readFileSync(specFile, "utf-8");

			for (const section of REQUIRED_SECTIONS) {
				if (!content.includes(section)) {
					errors.push(`Missing section: ${section}`);
				}
			}

			if (content.length > 3000) {
				warnings.push("Spec exceeds 3000 chars (should be thin — max 1 page)");
			}

			const hasChecklist = /-\s*\[[ x]\]\s*\*\*/i.test(content);
			if (!hasChecklist && content.includes("## Acceptance Criteria")) {
				errors.push(
					"Acceptance Criteria section exists but has no checklist items",
				);
			}
		}

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
