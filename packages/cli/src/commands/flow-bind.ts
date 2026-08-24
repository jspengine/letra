import { resolve } from "node:path";
import chalk from "chalk";
import { loadHarness, resolveHarnessRoot } from "../harness/loader.js";
import { loadWorkflow, type Workflow, writeWorkflow } from "./flow-init.js";

export interface FlowBindOptions {
	template: string;
	harnessVersion: string;
}

function incompatibleStageIds(workflow: Workflow, templateStageIds: Set<string>): string[] {
	const referencedStages = new Set([
		...workflow.stages.map((stage) => stage.id),
		...workflow.items.map((item) => item.stage),
	]);
	return [...referencedStages].filter((stageId) => !templateStageIds.has(stageId));
}

export async function flowBind(root: string, options: FlowBindOptions): Promise<boolean> {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found. Run 'letra flow init --quick' first"));
		return false;
	}

	const harnessRoot = resolveHarnessRoot(root, options.harnessVersion);
	const harness = loadHarness(harnessRoot);
	if (!harness) {
		console.log(
			chalk.red(`Harness "${options.harnessVersion}" not found or invalid at ${harnessRoot}`),
		);
		return false;
	}

	const template = harness.flows[options.template];
	if (!template) {
		console.log(
			chalk.red(
				`Flow template "${options.template}" not found in harness ${options.harnessVersion}`,
			),
		);
		return false;
	}

	const incompatibleStages = incompatibleStageIds(
		workflow,
		new Set(template.stages.map((stage) => stage.id)),
	);
	if (incompatibleStages.length > 0) {
		console.log(
			chalk.red(
				`Flow template "${options.template}" is incompatible with current stages: ${incompatibleStages.join(", ")}`,
			),
		);
		return false;
	}

	workflow.template = template.id;
	workflow.harnessVersion = options.harnessVersion;
	workflow.updatedAt = new Date().toISOString();

	const result = await writeWorkflow(root, {
		workflow,
		source: "flow-bind",
		skipSitrep: true,
	});
	if (!result.ok) {
		console.log(chalk.red(result.error ?? "Failed to bind workflow to harness"));
		return false;
	}

	console.log(`  ${chalk.green("✓")} Flow bound to ${template.id}@${options.harnessVersion}`);
	return true;
}

export async function flowBindAction(
	targetPath: string | undefined,
	options: FlowBindOptions,
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await flowBind(root, options);
}
