import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { type Workflow, loadWorkflow, saveWorkflow } from "./flow-init.js";

export function flowExport(
	root: string,
	options?: { minified?: boolean },
): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found"));
		return;
	}
	const json = JSON.stringify(workflow, null, options?.minified ? 0 : 2);
	console.log(json);
}

export function flowExportAction(
	targetPath: string | undefined,
	options?: { minified?: boolean },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowExport(root, options);
}

function now(): string {
	return new Date().toISOString();
}

export function flowImport(root: string, filePath: string): void {
	if (!existsSync(filePath)) {
		console.log(chalk.red(`File not found: ${filePath}`));
		process.exit(1);
	}

	let parsed: unknown;
	try {
		const content = readFileSync(filePath, "utf-8");
		parsed = JSON.parse(content);
	} catch {
		console.log(chalk.red("Invalid JSON file"));
		process.exit(1);
	}

	const obj = parsed as Record<string, unknown>;

	if (!obj.name || typeof obj.name !== "string" || !obj.name.trim()) {
		console.log(chalk.red("Missing required field: name (non-empty string)"));
		process.exit(1);
	}

	if (!obj.stages || !Array.isArray(obj.stages) || obj.stages.length === 0) {
		console.log(chalk.red("Missing required field: stages (non-empty array)"));
		process.exit(1);
	}

	const imported = parsed as Workflow;

	const existingWorkflow = loadWorkflow(root);
	if (existingWorkflow) {
		const backup = join(
			root,
			".letra",
			`workflow.v${existingWorkflow.version}.json`,
		);
		if (!existsSync(backup)) {
			writeFileSync(backup, JSON.stringify(existingWorkflow, null, 2));
			console.log(
				chalk.gray(
					`Backup saved: .letra/workflow.v${existingWorkflow.version}.json`,
				),
			);
		}
	}

	imported.createdAt = now();
	imported.updatedAt = now();
	saveWorkflow(root, imported);

	console.log(
		chalk.green(`Workflow imported: ${imported.name} (${imported.version})`),
	);
}

export function flowImportAction(
	targetPath: string | undefined,
	filePath: string,
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowImport(root, filePath);
}
