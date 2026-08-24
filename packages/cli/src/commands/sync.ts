import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { readFocusFile } from "../adapters/focus-sync.js";
import { getLetraDir } from "./../workspace/resolver.js";

export async function validateFocus(
	focusSpec: string,
	items: Array<{ id: string; spec?: string; stage: string; description: string }>,
	stages: Array<{ id: string }>,
): Promise<string[]> {
	const warnings: string[] = [];
	const doneIds = new Set(stages.filter((s) => s.id === "done").map((s) => s.id));
	const matchingItems = items.filter((i) => i.spec === focusSpec);

	if (matchingItems.length === 0) {
		warnings.push(`Focus spec "${focusSpec}" does not match any item's spec in workflow`);
	} else {
		for (const item of matchingItems) {
			if (doneIds.has(item.stage)) {
				warnings.push(
					`Focus spec "${focusSpec}" matches ${item.id} which is in "done" stage`,
				);
			}
		}
	}
	return warnings;
}

export async function syncNow(
	rootPath: string,
	options?: { dryRun?: boolean; skipSitrep?: boolean },
): Promise<{ ok: boolean; filesUpdated: string[]; warnings: string[]; error?: string }> {
	const workflowFile = join(getLetraDir(rootPath), "workflow.json");
	if (!existsSync(workflowFile)) {
		return {
			ok: false,
			filesUpdated: [],
			warnings: [],
			error: "No workflow found at .letra/workflow.json",
		};
	}

	const workflow = loadWorkflow(rootPath);
	if (!workflow) {
		return { ok: false, filesUpdated: [], warnings: [], error: "Failed to load workflow" };
	}

	// Validate focus.md
	const warnings: string[] = [];
	const focus = readFocusFile(rootPath);
	if (focus?.specName) {
		const focusWarnings = await validateFocus(focus.specName, workflow.items, workflow.stages);
		warnings.push(...focusWarnings);
	}

	if (options?.dryRun) {
		const filesUpdated = [
			".letra/workflow.json",
			...(workflow.tools || []).map((t: string) => t),
			".letra/context.md",
		];
		return { ok: true, filesUpdated, warnings, error: undefined };
	}

	const result = await writeWorkflow(rootPath, {
		workflow,
		source: "flow-edit",
		skipSitrep: options?.skipSitrep ?? false,
	});
	return { ...result, warnings };
}

export default function () {
	const cmd = new Command("sync").description("Sync workflow state to all adapters");

	cmd.option("--dry-run", "Show what would be done without writing")
		.option("--fix", "Apply reconciliation (default behavior)")
		.action(async (opts: { dryRun?: boolean; fix?: boolean }) => {
			const root = resolve(process.cwd());
			const isDryRun = !!opts.dryRun;
			const result = await syncNow(root, { dryRun: isDryRun });

			if (!result.ok) {
				console.log(chalk.red(`✗ Sync failed: ${result.error ?? "unknown error"}`));
				process.exit(1);
			}

			if (result.warnings.length > 0) {
				for (const w of result.warnings) {
					console.log(chalk.yellow(`  ⚠ ${w}`));
				}
			}

			if (isDryRun) {
				console.log(chalk.bold("\n📋 Simulação — dry-run\n"));
				console.log(chalk.gray("  Seriam regenerados:"));
				for (const f of result.filesUpdated) {
					console.log(`  ${chalk.gray("→")} ${f}`);
				}
				return;
			}

			console.log(chalk.green("✓ Workflow synced"));
			for (const f of result.filesUpdated) {
				console.log(`  ${chalk.gray("→")} ${f}`);
			}
		});

	return cmd;
}
