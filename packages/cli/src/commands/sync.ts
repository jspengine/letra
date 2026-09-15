import { existsSync, readFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { readFocusFile } from "../adapters/focus-sync.js";
import { getLetraDir, LETRA_FOLDER } from "./../workspace/resolver.js";
import { inspectWorkspaceIntegrity } from "../workspace/integrity.js";
import { logEntry } from "../session-log.js";

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

export type MirrorDirection = "workspace-to-location" | "location-to-workspace" | "link-to-workspace";

export interface MirrorOptions {
	direction: MirrorDirection;
	dryRun?: boolean;
	backup?: boolean;
}

/**
 * Reconciles the project pointer explicitly. Operational state is never
 * merged: a local projection that differs from the canonical workflow is a
 * conflict and must be resolved by the operator.
 */
export function syncMirror(rootPath: string, options: MirrorOptions) {
	const root = resolve(rootPath);
	const report = inspectWorkspaceIntegrity(root);
	const linkPath = join(report.resolution.locationPath, ".letra-link");
	const canonicalWorkflow = join(report.resolution.workspaceDir, "workflow.json");
	const projectedWorkflow = join(report.resolution.locationPath, LETRA_FOLDER, "workflow.json");
	const filesUpdated: string[] = [];
	const warnings: string[] = [];
	const sameFile = (left: string, right: string) =>
		existsSync(left) && existsSync(right) && readFileSync(left, "utf8") === readFileSync(right, "utf8");
	const backup = (path: string) => {
		if (!options.backup || !existsSync(path)) return;
		const destination = `${path}.backup`;
		copyFileSync(path, destination);
		filesUpdated.push(destination);
	};
	const copyChanged = (source: string, destination: string) => {
		if (sameFile(source, destination)) return;
		backup(destination);
		mkdirSync(dirname(destination), { recursive: true });
		copyFileSync(source, destination);
		filesUpdated.push(destination);
	};
	const auditSync = (code: string) => {
		try {
			logEntry(report.resolution.workspaceDir, "system", `sync mirror: ${options.direction}`, {
				details: { code, direction: options.direction, filesUpdated, dryRun: !!options.dryRun },
			});
		} catch {
			warnings.push("AUDIT_DEGRADED: sincronização concluída sem registro no sink de auditoria.");
		}
	};

	if (report.code === "WORKSPACE_LINK_INVALID" && options.direction !== "link-to-workspace") {
		return { ok: false, code: "WORKSPACE_LINK_INVALID", filesUpdated, warnings: ["O .letra-link é inválido; corrija o destino antes de sincronizar dados."], report };
	}
	if (options.direction === "location-to-workspace" && report.drifts.some((drift) => drift.code === "WORKSPACE_PROJECTION_DRIFT")) {
		return { ok: false, code: "WORKSPACE_SYNC_CONFLICT", filesUpdated, warnings: ["A projeção local diverge do workflow canônico; escolha uma direção explícita de recuperação antes de sobrescrever estado operacional."], report };
	}

	if (options.direction === "link-to-workspace") {
		const target = report.resolution.workspaceDir.replace(/\\/g, "/");
		if (report.resolution.errorCode === "WORKSPACE_LINK_INVALID" || !existsSync(canonicalWorkflow)) {
			return { ok: false, code: "WORKSPACE_LINK_INVALID", filesUpdated, warnings: ["Não há workspace canônico válido para reparar o link."], report };
		}
		if (!existsSync(linkPath) || readFileSync(linkPath, "utf8").trim().split("\n")[0] !== target) {
			filesUpdated.push(linkPath);
			if (options.dryRun && options.backup && existsSync(linkPath)) filesUpdated.push(`${linkPath}.backup`);
			if (!options.dryRun) {
				backup(linkPath);
				mkdirSync(report.resolution.locationPath, { recursive: true });
				writeFileSync(linkPath, `${target}\n`, "utf8");
			}
		}
	} else if (options.direction === "workspace-to-location") {
		if (!existsSync(canonicalWorkflow)) return { ok: false, code: "WORKSPACE_NOT_FOUND", filesUpdated, warnings: [], report };
		if (!options.dryRun) copyChanged(canonicalWorkflow, projectedWorkflow);
		else if (!sameFile(canonicalWorkflow, projectedWorkflow)) {
			if (options.backup && existsSync(projectedWorkflow)) filesUpdated.push(`${projectedWorkflow}.backup`);
			filesUpdated.push(projectedWorkflow);
		}
	} else {
		if (!existsSync(projectedWorkflow)) return { ok: false, code: "WORKSPACE_PROJECTION_NOT_FOUND", filesUpdated, warnings: [], report };
		if (!options.dryRun) copyChanged(projectedWorkflow, canonicalWorkflow);
		else if (!sameFile(projectedWorkflow, canonicalWorkflow)) {
			if (options.backup && existsSync(canonicalWorkflow)) filesUpdated.push(`${canonicalWorkflow}.backup`);
			filesUpdated.push(canonicalWorkflow);
		}
	}

	auditSync(options.direction === "link-to-workspace" ? "WORKSPACE_LINK_REPAIRED" : options.dryRun ? "WORKSPACE_MIRROR_DRY_RUN" : "WORKSPACE_MIRROR_COMPLETED");
	return { ok: true, code: options.dryRun ? "WORKSPACE_SYNC_DRY_RUN" : "WORKSPACE_SYNCED", filesUpdated, warnings, report };
}

export default function () {
	const cmd = new Command("sync").description("Sync workflow state to all adapters");

	cmd.option("--dry-run", "Show what would be done without writing")
		.option("--mirror <direction>", "Reconcile explicitly: workspace-to-location, location-to-workspace or link-to-workspace")
		.option("--backup", "Back up the existing .letra-link before changing it")
		.option("--fix", "Apply reconciliation (default behavior)")
		.action(async (opts: { dryRun?: boolean; fix?: boolean; mirror?: MirrorDirection; backup?: boolean }) => {
			const root = resolve(process.cwd());
			const isDryRun = !!opts.dryRun;
			if (opts.mirror) {
				const result = syncMirror(root, { direction: opts.mirror, dryRun: isDryRun, backup: opts.backup });
				if (!result.ok) {
					console.log(chalk.red(`✗ ${result.code}`));
					for (const warning of result.warnings) console.log(chalk.yellow(`  ⚠ ${warning}`));
					process.exitCode = 2;
					return;
				}
				console.log(chalk.green(`✓ ${result.code}`));
				for (const file of result.filesUpdated) console.log(`  ${chalk.gray("→")} ${file}`);
				return;
			}
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
