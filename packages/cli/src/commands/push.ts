import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import chalk from "chalk";
import { resolveWorkspaceRoot, isWorkspaceMode, LINK_FILE } from "../workspace/resolver.js";
import { loadWorkflow } from "./flow-init.js";
import { generateAdapters } from "../adapters/generate.js";

export async function push(
	targetPath?: string,
	options?: { dryRun?: boolean; quiet?: boolean },
): Promise<void> {
	const cwd = targetPath ? resolve(process.cwd(), targetPath) : process.cwd();
	const resolution = resolveWorkspaceRoot(cwd);

	if (!isWorkspaceMode(resolution)) {
		console.log(
			chalk.yellow(
				"Nenhum workspace isolado detectado. Use `letra init --workspace <nome>` primeiro.",
			),
		);
		return;
	}

	const workflow = loadWorkflow(resolution.targetDir);
	if (!workflow) {
		console.log(chalk.yellow("Nenhum workflow encontrado no workspace."));
		return;
	}

	const { workspaceDir, targetDir } = resolution;
	const dryRun = options?.dryRun ?? false;
	const quiet = options?.quiet ?? false;

	if (!quiet) {
		console.log(chalk.cyan(`\n  Workspace: ${workspaceDir}`));
		console.log(chalk.cyan(`  Target:    ${targetDir}`));
		console.log(chalk.cyan(`  Dry-run:   ${dryRun ? "sim" : "não"}\n`));
	}

	const files: string[] = [];

	// A project location contains only a lightweight pointer; governance stays
	// in the workspace data directory and is never copied into the code checkout.
	if (resolve(targetDir) !== resolve(workspaceDir)) {
		const linkPath = join(targetDir, LINK_FILE);
		if (existsSync(linkPath)) {
			const linkedTarget = readFileSync(linkPath, "utf8").trim().split("\n")[0] ?? "";
			if (!linkedTarget || resolve(targetDir, linkedTarget) !== resolve(workspaceDir)) {
				console.log(chalk.red(`  Conflito: ${LINK_FILE} já aponta para outro workspace; nada foi alterado.`));
				return;
			}
		} else {
			files.push(LINK_FILE);
			if (!dryRun) writeFileSync(linkPath, `${workspaceDir}\n`, "utf8");
		}
	}

	// Determine which tools to use (per-location adapters override global tools)
	const normalizedTarget = targetDir.replace(/\\/g, "/");
	const relativeTarget = relative(process.cwd(), targetDir).replace(/\\/g, "/");
	const targetConfig = workflow.locations?.find((location) => {
		const locationPath = location.path.replace(/\\/g, "/");
		return (
			locationPath === normalizedTarget ||
			locationPath === relativeTarget ||
			locationPath === targetPath
		);
	});
	const effectiveTools =
		targetConfig?.adapters && targetConfig.adapters.length > 0
			? targetConfig.adapters
			: workflow.tools;

	// Generate adapter artifacts in the external governance directory, never in
	// the project checkout.
	if (effectiveTools && effectiveTools.length > 0) {
		const activeStage = workflow.primaryItemId
			? workflow.items.find((i) => i.id === workflow.primaryItemId)?.stage
			: workflow.items[0]?.stage;
		for (const tool of effectiveTools) {
			files.push(`adapters/${tool}/`);
			if (!dryRun) generateAdapters(join(workspaceDir, "adapters", tool), [tool], {
				source: "flow-move",
				workflow: {
					name: workflow.name,
					stages: workflow.stages,
					items: workflow.items,
				},
				activeStageId: activeStage || workflow.stages[0]?.id || "backlog",
				primaryItemId: workflow.primaryItemId || workflow.items[0]?.id,
				workspaceDir,
				contentRoot: workspaceDir,
			});
		}
	}

	if (!quiet) {
		if (files.length === 0) {
			console.log(chalk.gray("  Nada para enviar.\n"));
		} else {
			const verb = dryRun ? "Enviaria" : "Enviado";
			console.log(chalk.green(`  ${verb} ${files.length} arquivo(s):`));
			for (const f of files.slice(0, 10)) {
				console.log(chalk.gray(`    • ${f}`));
			}
			if (files.length > 10) {
				console.log(chalk.gray(`    + ${files.length - 10} outro(s)`));
			}
			console.log();
		}
	}
}
