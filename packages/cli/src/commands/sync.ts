import { existsSync, readFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";
import { readFocusFile } from "../adapters/focus-sync.js";
import { regenerateLocationAdapters } from "../adapters/regenerate.js";
import { clearWorkspaceCache, getLetraDir, LETRA_FOLDER, resolveWorkspaceRoot } from "./../workspace/resolver.js";
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

/**
 * Regenerate the agent instruction files of every location of the active
 * workspace (ITEM-19/27). Never writes workflow state: it only renders the
 * stable bootstrap. Human-authored files are reported as conflicts.
 */
export function regenerateWorkspaceAdapters(
	rootPath: string,
	options: { dryRun?: boolean } = {},
): { ok: boolean; filesUpdated: string[]; conflicts: string[]; error?: string } {
	const workflow = loadWorkflow(rootPath);
	if (!workflow) {
		const workflowFile = join(getLetraDir(rootPath), "workflow.json");
		return { ok: false, filesUpdated: [], conflicts: [], error: `No workflow found at ${workflowFile}` };
	}
	const resolution = resolveWorkspaceRoot(rootPath);
	const locations = (workflow.locations ?? []).length
		? (workflow.locations ?? []).map((location) => ({ path: location.path, adapters: location.adapters ?? [] }))
		: [{ path: resolution.locationPath, adapters: [] as string[] }];
	const filesUpdated: string[] = [];
	const conflicts: string[] = [];
	for (const location of locations) {
		if (!existsSync(location.path)) continue;
		const result = regenerateLocationAdapters(location.path, {
			tools: [...new Set([...(workflow.tools ?? []), ...location.adapters])],
			contentRoot: resolution.workspaceDir,
			dryRun: options.dryRun,
		});
		for (const file of result.files) {
			if (file.action === "conflict") conflicts.push(file.path);
			else if (file.action !== "unchanged") filesUpdated.push(file.path);
		}
	}
	return { ok: true, filesUpdated, conflicts };
}

export async function syncNow(
	rootPath: string,
	options?: { dryRun?: boolean; skipSitrep?: boolean },
): Promise<{ ok: boolean; filesUpdated: string[]; warnings: string[]; error?: string }> {
	const workflow = loadWorkflow(rootPath);
	if (!workflow) {
		const workflowFile = join(getLetraDir(rootPath), "workflow.json");
		return { ok: false, filesUpdated: [], warnings: [], error: `No workflow found at ${workflowFile}` };
	}

	const warnings: string[] = [];
	const focus = readFocusFile(rootPath);
	if (focus?.specName) {
		warnings.push(...(await validateFocus(focus.specName, workflow.items, workflow.stages)));
	}

	const result = regenerateWorkspaceAdapters(rootPath, { dryRun: options?.dryRun });
	for (const path of result.conflicts) {
		warnings.push(`Arquivo de autoria humana preservado (sem cabeçalho do Letra): ${path}`);
	}
	return { ok: result.ok, filesUpdated: result.filesUpdated, warnings, error: result.error };
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
		// ITEM-19 AC3: the location now points to this workspace; its agent
		// instruction files must be this workspace's bootstrap.
		clearWorkspaceCache();
		const regenerated = regenerateWorkspaceAdapters(report.resolution.locationPath, { dryRun: options.dryRun });
		filesUpdated.push(...regenerated.filesUpdated);
		for (const path of regenerated.conflicts) warnings.push(`Arquivo de autoria humana preservado: ${path}`);
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

			console.log(chalk.green(result.filesUpdated.length ? "✓ Adapters regenerados" : "✓ Adapters já atualizados"));
			for (const f of result.filesUpdated) {
				console.log(`  ${chalk.gray("→")} ${f}`);
			}
		});

	return cmd;
}
