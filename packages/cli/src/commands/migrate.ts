import { existsSync, cpSync, rmSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { resolveWorkspaceRoot, LINK_FILE, clearWorkspaceCache } from "../workspace/resolver.js";
import { ensureExternalWorkspaceLayout, getWorkspacesDir, slugifyWorkspaceName } from "../workspace/index.js";
import { loadWorkflow } from "./flow-init.js";

const EXTERNAL_ROOT = getWorkspacesDir();

function workspaceName(root: string): string {
	const wf = loadWorkflow(root);
	return wf?.name || slugifyWorkspaceName(root);
}

export type MigrateResult = { ok: boolean; from: string; to: string; cleaned: boolean; message: string };

function copyDirectoryContents(source: string, target: string): void {
	mkdirSync(target, { recursive: true });
	for (const entry of readdirSync(source)) {
		cpSync(join(source, entry), join(target, entry), { recursive: true, force: true });
	}
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
export async function migrateWorkspace(rootPath: string, options?: { to?: string; clean?: boolean; dryRun?: boolean }): Promise<MigrateResult> {
	const cwd = rootPath ? resolve(process.cwd(), rootPath) : process.cwd();
	const resolution = resolveWorkspaceRoot(cwd);
	const source = resolution.workspaceDir;
	const rootForLink = resolution.workspaceRoot;

	if (!existsSync(source)) {
		return { ok: false, from: source, to: "", cleaned: false, message: `Source data directory not found at ${source}` };
	}

	// Already externalized?
	if (resolution.type === "linked") {
		return { ok: false, from: source, to: source, cleaned: false, message: "Workspace is already externalized (linked). Nothing to migrate." };
	}

	const name = workspaceName(rootForLink);
	const slug = slugifyWorkspaceName(name);
	let target = options?.to ? (isAbsolute(options.to) ? options.to : resolve(cwd, options.to)) : join(EXTERNAL_ROOT, slug);

	if (existsSync(target) && existsSync(join(target, "workflow.json"))) {
		return { ok: false, from: source, to: target, cleaned: false, message: `Target already contains a workflow.json (${target}). Move it first or pass --to <path>.` };
	}

	if (options?.dryRun) {
		return { ok: true, from: source, to: target, cleaned: false, message: `[dry-run] Would copy ${source} -> ${target} and write ${LINK_FILE} at ${rootForLink}` };
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
	writeFileSync(join(rollbackDir, "rollback.json"), JSON.stringify({
		id: migrationId,
		source,
		target,
		linkPath: join(rootForLink, LINK_FILE),
		snapshotPath: rollbackSnapshotDir,
		restore: "Copy snapshotPath back to source and remove .letra-link from linkPath.",
	}, null, 2), "utf-8");
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
	writeFileSync(join(evidenceDir, `${migrationId}.json`), JSON.stringify({
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
	}, null, 2), "utf-8");

	return { ok: true, from: source, to: target, cleaned, message: `Migrated data to ${target} (${cleaned ? "source removed" : "source kept"}).` };
}

export default function migrateCommand() {
	const cmd = new Command("migrate")
		.description("Externalize a workspace's .letra directory to ~/.letra/workspaces/{slug}/ and leave a link")
		.argument("[root]", "workspace root (defaults to cwd)")
		.option("--to <path>", "target data directory (overrides default)")
		.option("--clean", "remove the original .letra directory after migrating")
		.option("--dry-run", "print what would happen without writing")
		.action(async (root: string | undefined, opts: { to?: string; clean?: boolean; dryRun?: boolean }) => {
			const result = await migrateWorkspace(root ?? ".", opts);
			if (!result.ok) {
				console.log(chalk.red(`✗ ${result.message}`));
				process.exitCode = 1;
			} else {
				console.log(chalk.green(`✓ ${result.message}`));
				console.log(`  from: ${result.from}`);
				console.log(`  to:   ${result.to}`);
			}
		});
	return cmd;
}
