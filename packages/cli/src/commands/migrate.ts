import { existsSync, cpSync, rmSync, mkdirSync, writeFileSync, readdirSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, isAbsolute, resolve, relative, sep, basename } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { resolveWorkspaceRoot, LINK_FILE, clearWorkspaceCache } from "../workspace/resolver.js";
import {
	ensureExternalWorkspaceLayout,
	getWorkspacesDir,
	slugifyWorkspaceName,
} from "../workspace/index.js";
import { loadWorkflow } from "./flow-init.js";

const EXTERNAL_ROOT = getWorkspacesDir();

function workspaceName(root: string): string {
	const wf = loadWorkflow(root);
	return wf?.name || slugifyWorkspaceName(root);
}

export type MigrateResult = {
	ok: boolean;
	from: string;
	to: string;
	cleaned: boolean;
	message: string;
};

function copyDirectoryContents(source: string, target: string): void {
	mkdirSync(target, { recursive: true });
	for (const entry of readdirSync(source)) {
		cpSync(join(source, entry), join(target, entry), { recursive: true, force: true });
	}
}

type ReconcileResult = { conflicts: string[]; missing: string[] };

function reconcileExternalizedCopy(source: string, target: string): ReconcileResult {
	const conflicts: string[] = [];
	const missing: string[] = [];
	const visit = (from: string, to: string) => {
		for (const entry of readdirSync(from, { withFileTypes: true })) {
			const src = join(from, entry.name);
			const dst = join(to, entry.name);
			if (!existsSync(dst)) {
				missing.push(relative(source, src).split(sep).join("/"));
				continue;
			}
			const srcStat = lstatSync(src);
			const dstStat = lstatSync(dst);
			if (srcStat.isDirectory() !== dstStat.isDirectory() || srcStat.isSymbolicLink() !== dstStat.isSymbolicLink()) {
				conflicts.push(relative(source, src).split(sep).join("/"));
				continue;
			}
			if (srcStat.isSymbolicLink()) {
				if (readlinkSync(src) !== readlinkSync(dst)) conflicts.push(relative(source, src).split(sep).join("/"));
			} else if (srcStat.isDirectory()) visit(src, dst);
			else if (srcStat.isFile()) {
				const srcHash = createHash("sha256").update(readFileSync(src)).digest("hex");
				const dstHash = createHash("sha256").update(readFileSync(dst)).digest("hex");
				if (srcHash !== dstHash) conflicts.push(relative(source, src).split(sep).join("/"));
			} else conflicts.push(relative(source, src).split(sep).join("/"));
		}
	};
	visit(source, target);
	return { conflicts, missing };
}

function cleanupLegacyDirectory(
	legacy: string,
	target: string,
	kind: "project-legacy" | "workspace-projection",
	dryRun: boolean,
): MigrateResult {
	const legacyPath = resolve(legacy);
	const targetPath = resolve(target);
	if (basename(legacyPath) !== ".letra" || legacyPath === targetPath) {
		return { ok: false, from: legacyPath, to: targetPath, cleaned: false, message: `Cleanup refused an unexpected legacy path: ${legacyPath}` };
	}
	const reconciliation = reconcileExternalizedCopy(legacyPath, targetPath);
	if (dryRun) {
		return {
			ok: true, from: legacyPath, to: targetPath, cleaned: false,
			message: `[dry-run] Would snapshot ${kind} .letra, copy ${reconciliation.missing.length} missing path(s), preserve ${reconciliation.conflicts.length} divergent path(s) in the snapshot while keeping ${targetPath} canonical, verify, then remove ${legacyPath}.${reconciliation.conflicts.length ? ` Conflicts: ${reconciliation.conflicts.join(", ")}` : ""}`,
		};
	}
	const migrationId = `cleanup-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const rollbackDir = join(targetPath, "operations", "rollbacks", migrationId);
	const snapshotPath = join(rollbackDir, "legacy-letra");
	mkdirSync(rollbackDir, { recursive: true });
	copyDirectoryContents(legacyPath, snapshotPath);
	for (const path of reconciliation.missing) {
		const src = join(legacyPath, ...path.split("/"));
		const dst = join(targetPath, ...path.split("/"));
		mkdirSync(join(dst, ".."), { recursive: true });
		cpSync(src, dst, { recursive: true, errorOnExist: true, force: false });
	}
	const finalCheck = reconcileExternalizedCopy(legacyPath, targetPath);
	const snapshotCheck = reconcileExternalizedCopy(legacyPath, snapshotPath);
	const expectedConflicts = [...reconciliation.conflicts].sort();
	const finalConflicts = [...finalCheck.conflicts].sort();
	if (
		finalCheck.missing.length > 0 ||
		JSON.stringify(finalConflicts) !== JSON.stringify(expectedConflicts) ||
		snapshotCheck.conflicts.length > 0 ||
		snapshotCheck.missing.length > 0
	) {
		return {
			ok: false, from: legacyPath, to: targetPath, cleaned: false,
			message: `Cleanup stopped after snapshot: source or target changed during reconciliation (conflicts: ${finalCheck.conflicts.join(", ")}; missing: ${finalCheck.missing.join(", ")}; snapshot conflicts: ${snapshotCheck.conflicts.join(", ")}; snapshot missing: ${snapshotCheck.missing.join(", ")}). Snapshot: ${snapshotPath}`,
		};
	}
	writeFileSync(join(rollbackDir, "rollback.json"), JSON.stringify({ id: migrationId, kind, source: legacyPath, target: targetPath, snapshotPath, canonicalTarget: targetPath, conflicts: reconciliation.conflicts, restore: "Copy snapshotPath back to source. Divergent files in target remain authoritative." }, null, 2), "utf-8");
	const evidenceDir = join(targetPath, "operations", "migrations");
	mkdirSync(evidenceDir, { recursive: true });
	writeFileSync(join(evidenceDir, `${migrationId}.json`), JSON.stringify({ id: migrationId, migratedAt: new Date().toISOString(), kind, from: legacyPath, to: targetPath, cleaned: true, canonicalTarget: targetPath, rollbackSnapshotPath: snapshotPath, conflicts: reconciliation.conflicts, copiedPaths: reconciliation.missing, conflictPolicy: "preserve-in-snapshot; canonical-target-wins" }, null, 2), "utf-8");
	rmSync(legacyPath, { recursive: true });
	return { ok: true, from: legacyPath, to: targetPath, cleaned: true, message: `Reconciled ${reconciliation.missing.length} missing path(s), preserved ${reconciliation.conflicts.length} divergent path(s) in the rollback snapshot, kept the external data directory canonical, and removed ${kind} .letra. Snapshot: ${snapshotPath}` };
}

/**
 * Migrate a workspace's internal data directory (`.letra/`) to an externalized
 * location at `~/.letra/workspaces/{slug}/`, leaving a `.letra-link` file
 * in the workspace root that points to the new data directory.
 *
 * This is the concrete step that turns a project into an "externalized" layout
 * so that `workflow.json`, `harness/`, `specs/`, etc. live outside the project
 * directory while the project itself stays clean (only the link remains).
 */
export async function migrateWorkspace(
	rootPath: string,
	options?: { to?: string; clean?: boolean; dryRun?: boolean },
): Promise<MigrateResult> {
	const cwd = rootPath ? resolve(process.cwd(), rootPath) : process.cwd();
	const resolution = resolveWorkspaceRoot(cwd);
	const source = resolution.workspaceDir;
	const rootForLink = resolution.type === "linked" && resolution.linkPath
		? resolve(resolution.linkPath, "..")
		: resolution.workspaceRoot;

	if (!existsSync(source)) {
		return {
			ok: false,
			from: source,
			to: "",
			cleaned: false,
			message: `Source data directory not found at ${source}`,
		};
	}

	// A linked workspace may contain both a project-local harness tree and a stale
	// nested projection in the canonical data directory. Clean each by snapshotting
	// first, copying only missing paths, and treating the data directory as authority.
	if (resolution.type === "linked") {
		if (!options?.clean) {
			return {
				ok: false,
				from: join(rootForLink, ".letra"),
				to: source,
				cleaned: false,
				message: "Workspace is already externalized. Use --clean to inspect and remove a reconciled legacy .letra copy.",
			};
		}
		const legacyProjectCopy = join(rootForLink, ".letra");
		const nestedProjection = join(source, ".letra");
		const results: MigrateResult[] = [];
		if (existsSync(legacyProjectCopy)) {
			const result = cleanupLegacyDirectory(legacyProjectCopy, source, "project-legacy", Boolean(options.dryRun));
			results.push(result);
			if (!result.ok || options.dryRun) return result;
		}
		if (existsSync(nestedProjection)) {
			const result = cleanupLegacyDirectory(nestedProjection, source, "workspace-projection", Boolean(options.dryRun));
			results.push(result);
			if (!result.ok || options.dryRun) return result;
		}
		if (results.length === 0) return { ok: true, from: legacyProjectCopy, to: source, cleaned: false, message: "No legacy .letra directory remains." };
		return { ok: true, from: legacyProjectCopy, to: source, cleaned: true, message: results.map((result) => result.message).join("\n") };
	}

	// External workspaces can also carry an old nested .letra projection. The
	// direct dataDir remains canonical; only the nested projection is reconciled.
	const nestedProjection = join(source, ".letra");
	if (resolution.type === "direct" && options?.clean && existsSync(nestedProjection)) {
		return cleanupLegacyDirectory(nestedProjection, source, "workspace-projection", Boolean(options.dryRun));
	}

	const name = workspaceName(rootForLink);
	const slug = slugifyWorkspaceName(name);
	const target = options?.to
		? isAbsolute(options.to)
			? options.to
			: resolve(cwd, options.to)
		: join(EXTERNAL_ROOT, slug);

	if (existsSync(target) && existsSync(join(target, "workflow.json"))) {
		return {
			ok: false,
			from: source,
			to: target,
			cleaned: false,
			message: `Target already contains a workflow.json (${target}). Move it first or pass --to <path>.`,
		};
	}

	if (options?.dryRun) {
		return {
			ok: true,
			from: source,
			to: target,
			cleaned: false,
			message: `[dry-run] Would copy ${source} -> ${target} and write ${LINK_FILE} at ${rootForLink}`,
		};
	}

	// 1. Materialize target
	mkdirSync(target, { recursive: true });
	// 2. Copy data directory contents into target (preserve nested .letra for legacy-externalized compat)
	copyDirectoryContents(source, target);
	ensureExternalWorkspaceLayout(target);
	const migrationId = `migration-${Date.now().toString(36)}`;
	const evidenceDir = join(target, "operations", "migrations");
	mkdirSync(evidenceDir, { recursive: true });
	const rollbackDir = join(target, "operations", "rollbacks", migrationId);
	const rollbackSnapshotDir = join(rollbackDir, "legacy-letra");
	copyDirectoryContents(source, rollbackSnapshotDir);
	writeFileSync(
		join(rollbackDir, "rollback.json"),
		JSON.stringify(
			{
				id: migrationId,
				source,
				target,
				linkPath: join(rootForLink, LINK_FILE),
				snapshotPath: rollbackSnapshotDir,
				restore: "Copy snapshotPath back to source and remove .letra-link from linkPath.",
			},
			null,
			2,
		),
		"utf-8",
	);
	// 3. Write link at workspace root and invalidate resolution cache so subsequent
	//    lookups (e.g. loadWorkflow right after migrate) follow the new link.
	writeFileSync(join(rootForLink, LINK_FILE), `${target}\n`, "utf-8");
	clearWorkspaceCache();
	// 4. Optionally remove the original data directory
	let cleaned = false;
	if (options?.clean) {
		rmSync(source, { recursive: true, force: true });
		cleaned = true;
	}
	writeFileSync(
		join(evidenceDir, `${migrationId}.json`),
		JSON.stringify(
			{
				id: migrationId,
				migratedAt: new Date().toISOString(),
				from: source,
				to: target,
				linkPath: join(rootForLink, LINK_FILE),
				cleaned,
				rollbackSnapshotPath: rollbackSnapshotDir,
				rollbackManifestPath: join(rollbackDir, "rollback.json"),
				rollback: cleaned
					? "Restore by copying rollbackSnapshotPath back to the original path and removing .letra-link."
					: "Restore by removing .letra-link; the original .letra directory was preserved.",
			},
			null,
			2,
		),
		"utf-8",
	);

	return {
		ok: true,
		from: source,
		to: target,
		cleaned,
		message: `Migrated data to ${target} (${cleaned ? "source removed" : "source kept"}).`,
	};
}

export default function migrateCommand() {
	const cmd = new Command("migrate")
		.description("Externalize workspace data or safely reconcile and clean a legacy .letra copy")
		.argument("[root]", "workspace root (defaults to cwd)")
		.option("--to <path>", "target data directory (overrides default)")
		.option("--clean", "remove the original .letra directory after migrating")
		.option("--dry-run", "print what would happen without writing")
		.action(
			async (
				root: string | undefined,
				opts: { to?: string; clean?: boolean; dryRun?: boolean },
			) => {
				const result = await migrateWorkspace(root ?? ".", opts);
				if (!result.ok) {
					console.log(chalk.red(`✗ ${result.message}`));
					process.exitCode = 1;
				} else {
					console.log(chalk.green(`✓ ${result.message}`));
					console.log(`  from: ${result.from}`);
					console.log(`  to:   ${result.to}`);
				}
			},
		);
	return cmd;
}
