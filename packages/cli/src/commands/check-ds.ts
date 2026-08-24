import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";

const FORBIDDEN = [
	/\bvar\(\s*--muted\s*\)/,
	/\bvar\(\s*--foreground\s*\)/,
	/\bvar\(\s*--background\s*\)/,
	/\bvar\(\s*--card\s*\)/,
	/\bvar\(\s*--primary\s*\)/,
	/\bvar\(\s*--success\s*\)/,
	/\bvar\(\s*--warning\s*\)/,
	/\bvar\(\s*--error\s*\)/,
	/\bvar\(\s*--live\s*\)/,
	/\bvar\(\s*--gate-/,
	/\bcolor:\s*"?white"?/,
	/25vw/,
	/w-80/,
	/text-\[10px\]/,
	/text-\[9px\]/,
	/text-\[8px\]/,
];

function collectFiles(dir: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (
			entry.isDirectory() &&
			entry.name !== "node_modules" &&
			entry.name !== "dist" &&
			!entry.name.startsWith(".")
		) {
			files.push(...collectFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".tsx")) {
			files.push(full);
		}
	}
	return files;
}

function checkFile(path: string) {
	const text = readFileSync(path, "utf-8");
	const issues: string[] = [];
	for (const re of FORBIDDEN) {
		const matches = text.match(re);
		if (matches) issues.push(`Forbidden pattern: ${re.source}`);
	}
	return issues;
}

export async function checkDs(targetPath?: string) {
	const root = resolve(process.cwd(), targetPath || ".");
	const clientDir = join(root, "packages", "client", "src");

	if (!existsSync(clientDir)) {
		console.log(chalk.red("Error: packages/client/src not found."));
		process.exit(1);
	}

	const files = collectFiles(clientDir);
	let totalIssues = 0;
	const results: { file: string; issues: string[] }[] = [];

	for (const file of files) {
		const issues = checkFile(file);
		if (issues.length > 0) {
			results.push({ file, issues });
			totalIssues += issues.length;
		}
	}

	if (results.length === 0) {
		console.log(chalk.green("DS conformance: OK"));
		process.exit(0);
	}

	console.log(chalk.red(`DS conformance: ${totalIssues} issue(s) found\n`));
	for (const result of results) {
		console.log(chalk.bold(`\nFile: ${result.file}`));
		for (const issue of result.issues) {
			console.log(chalk.red(`  ✗ ${issue}`));
		}
	}

	process.exit(1);
}
