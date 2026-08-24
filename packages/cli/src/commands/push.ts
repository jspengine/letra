import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join, relative } from "node:path";
import chalk from "chalk";
import { resolveWorkspaceRoot, getSpecsDir, isWorkspaceMode } from "../workspace/resolver.js";
import { loadWorkflow } from "./flow-init.js";
import { generateAdapters } from "../adapters/generate.js";
import { getLetraDir } from "./../workspace/resolver.js";

export async function push(
	targetPath?: string,
	options?: { dryRun?: boolean; quiet?: boolean },
): Promise<void> {
	const cwd = targetPath ? join(process.cwd(), targetPath) : process.cwd();
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

	// Copy specs to target
	const specsDir = getSpecsDir(resolution.workspaceDir);
	if (existsSync(specsDir)) {
		const targetSpecs = join(getLetraDir(targetDir), "specs");
		if (!existsSync(targetSpecs)) mkdirSync(targetSpecs, { recursive: true });
		if (!dryRun) {
			cpSync(specsDir, targetSpecs, { recursive: true, force: true });
		}
		const specFiles = readdirSyncSimple(specsDir);
		for (const f of specFiles) {
			files.push(`.letra/specs/${relative(specsDir, f)}`);
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

	// Generate adapters in target
	if (effectiveTools && effectiveTools.length > 0 && !dryRun) {
		const activeStage = workflow.primaryItemId
			? workflow.items.find((i) => i.id === workflow.primaryItemId)?.stage
			: workflow.items[0]?.stage;
		generateAdapters(targetDir, effectiveTools, {
			source: "flow-move",
			workflow: {
				name: workflow.name,
				stages: workflow.stages,
				items: workflow.items,
			},
			activeStageId: activeStage || workflow.stages[0]?.id || "backlog",
			primaryItemId: workflow.primaryItemId || workflow.items[0]?.id,
			workspaceDir,
		});
		files.push(
			"AGENTS.md",
			".cursorrules",
			"CLAUDE.md",
			".windsurfrules",
			".github/copilot-instructions.md",
		);
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

function readdirSyncSimple(dir: string): string[] {
	try {
		return require("node:fs").readdirSync(dir, { recursive: true }) as string[];
	} catch {
		return [];
	}
}
