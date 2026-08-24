import { existsSync, mkdirSync, statSync, readFileSync } from "node:fs";
import { join, isAbsolute, resolve, dirname, parse } from "node:path";
import { getWorkspacePath, detectManifest, ensureLetraDirs } from "./index.js";

export interface WorkspaceResolution {
	dataDir: string;
	locationPath: string;
	workspaceDir: string;
	targetDir: string;
	workspaceRoot: string;
	/** @deprecated use workspaceRoot */
	projectRoot: string;
	type: "local" | "manifest" | "env" | "flag" | "linked" | "direct";
}

const ENV_KEY = "LETRA_WORKSPACE";
export const LINK_FILE = ".letra-link";
export const LETRA_FOLDER = ".letra";

// Caches for filesystem hot paths (keyed by absolute directory path).
// resolveWorkspaceRoot caches the upward walk; resolveDataDir caches the
// single-level lookup. Both are invalidated together by clearWorkspaceCache()
// whenever the workspace directory layout is mutated (e.g. `letra migrate`).
const workspaceRootCache = new Map<string, WorkspaceResolution>();
const dataDirCache = new Map<string, string | null>();

function getFlagWorkspace(): string | null {
	const idx = process.argv.indexOf("--workspace");
	if (idx === -1 || idx + 1 >= process.argv.length) return null;
	const val = process.argv[idx + 1];
	if (val.startsWith("--")) return null;
	return val;
}

function getEnvWorkspace(): string | null {
	return process.env[ENV_KEY] ?? null;
}

function parseLinkTarget(dir: string, target: string): string {
	return isAbsolute(target) ? target : resolve(dir, target);
}

function readLinkTarget(dir: string): { path: string; target: string; dataDir: string } | null {
	const linkPath = join(dir, LINK_FILE);
	if (!existsSync(linkPath)) return null;
	const content = readFileSync(linkPath, "utf-8").trim();
	const target = content.split("\n")[0].trim();
	if (!target) {
		console.warn(`Letra link at ${linkPath} is empty — ignoring.`);
		return null;
	}
	const dataPath = parseLinkTarget(dir, target);
	if (!existsSync(dataPath)) {
		console.warn(
			`Letra link target does not exist (${dataPath}) — falling back to local .letra/.`,
		);
		return null;
	}
	const directWorkflow = join(dataPath, "workflow.json");
	const legacyHarnessDir = join(dataPath, LETRA_FOLDER);
	const legacyWorkflow = join(legacyHarnessDir, "workflow.json");
	if (existsSync(directWorkflow)) {
		return { path: linkPath, target: dataPath, dataDir: dataPath };
	}
	if (existsSync(legacyWorkflow)) {
		return { path: linkPath, target: dataPath, dataDir: legacyHarnessDir };
	}
	console.warn(
		`Letra link target (${dataPath}) has no workflow.json — falling back to local .letra/.`,
	);
	return null;
}

function resolution(
	input: Omit<WorkspaceResolution, "dataDir" | "locationPath" | "projectRoot"> & {
		projectRoot?: string;
	},
): WorkspaceResolution {
	return {
		...input,
		dataDir: input.workspaceDir,
		locationPath: input.targetDir,
		projectRoot: input.projectRoot ?? input.workspaceRoot,
	};
}

/**
 * Resolve the workspace root directory and associated metadata starting from
 * the given `cwd` (or `process.cwd()` if omitted).
 *
 * Resolution order:
 * 1. Environment variable LETRA_WORKSPACE (env mode)
 * 2. --workspace flag (flag mode)
 * 3. Direct data directory containing `workflow.json` (direct mode)
 * 4. `.letra-link` file in the cwd or ancestor directories (linked mode)
 *    - Direct layout: the link target contains `workflow.json` at top level (data dir).
 *    - Legacy externalized layout: the link target contains a `.letra/` subfolder.
 * 5. `letra.manifest.json` in the cwd or ancestors (manifest mode)
 * 6. A `.letra/` directory in the cwd or ancestors (local mode)
 * 7. Fallback: assume the cwd / starting directory is a local workspace
 *    with a `.letra/` folder (even if the folder does not yet exist).
 *
 * @param cwd Optional starting directory; defaults to process.cwd()
 * @returns a non-null WorkspaceResolution (fallback never returns null)
 */
export function resolveWorkspaceRoot(cwd?: string): WorkspaceResolution {
	const start = cwd ?? process.cwd();
	if (workspaceRootCache.has(start)) return workspaceRootCache.get(start)!;

	let dir = start;
	const root = parse(dir).root;
	const originalCwd = start; // targetDir is the directory resolution started from

	const result = (function walk(): WorkspaceResolution {
		while (dir && dir !== root) {
			// 1. Environment variable
			const envWs = getEnvWorkspace();
			if (envWs) {
				const wsDir = getWorkspacePath(envWs);
				if (existsSync(join(wsDir, "workspace.json"))) {
					const workspaceRoot = dirname(wsDir);
					return resolution({
						workspaceDir: wsDir,
						targetDir: originalCwd,
						workspaceRoot,
						type: "env",
					});
				}
			}

			// 2. Flag --workspace
			const flagWs = getFlagWorkspace();
			if (flagWs) {
				const wsDir = getWorkspacePath(flagWs);
				if (existsSync(join(wsDir, "workspace.json"))) {
					const workspaceRoot = dirname(wsDir);
					return resolution({
						workspaceDir: wsDir,
						targetDir: originalCwd,
						workspaceRoot,
						type: "flag",
					});
				}
			}

			// 3. Direct data directory
			if (existsSync(join(dir, "workflow.json"))) {
				return resolution({
					workspaceDir: dir,
					targetDir: originalCwd,
					workspaceRoot: dir,
					type: "direct",
				});
			}

			// 4. .letra-link (externalized data)
			const linked = readLinkTarget(dir);
			if (linked) {
				return resolution({
					workspaceDir: linked.dataDir,
					targetDir: originalCwd,
					workspaceRoot: linked.target,
					type: "linked",
				});
			}

			// 5. Manifest mode
			const manifest = detectManifest(dir);
			if (manifest) {
				const workspaceRoot = dirname(manifest.path);
				return resolution({
					workspaceDir: join(workspaceRoot, LETRA_FOLDER),
					targetDir: originalCwd,
					workspaceRoot,
					type: "manifest",
				});
			}

			// 6. Local layout: dir contains a .letra/ subfolder
			const localLetra = join(dir, LETRA_FOLDER);
			if (existsSync(localLetra) && statSync(localLetra).isDirectory()) {
				return resolution({
					workspaceDir: localLetra,
					targetDir: originalCwd,
					workspaceRoot: dir,
					type: "local",
				});
			}

			dir = dirname(dir);
		}

		// 6. Fallback
		return resolution({
			workspaceDir: join(originalCwd, LETRA_FOLDER),
			targetDir: originalCwd,
			workspaceRoot: originalCwd,
			type: "local",
		});
	})();

	workspaceRootCache.set(start, result);
	return result;
}

/**
 * Clear the workspace resolution cache. Call this after any operation that
 * mutates the workspace directory layout (e.g. `letra migrate`, `letra init`).
 */
export function clearWorkspaceCache(): void {
	workspaceRootCache.clear();
	dataDirCache.clear();
}

/**
 * Resolve the effective workspace data directory (the directory that contains
 * workflow.json, specs/, focus.md, etc.) given a starting root — **without**
 * walking up the filesystem tree, so initialization and explicit paths behave
 * deterministically.
 *
 * Resolution order (all at the `root` level only):
 * 1. If `root` contains `workflow.json` at its top level → `root` (direct/externalized).
 * 2. If `root` contains a `.letra-link` → read it and resolve the target
 *    (direct or legacy-nested layout).
 * 3. If `root` contains a `.letra/` subfolder → join(root, folder) (legacy).
 * 4. Otherwise → null.
 */
export function resolveDataDir(root: string): string | null {
	const cached = dataDirCache.get(root);
	if (cached !== undefined) return cached;

	let result: string | null = null;
	// ... (direct link local) ...

	// 1. Direct layout: root itself is the data directory
	if (existsSync(join(root, "workflow.json"))) {
		result = root;
	}

	// 2. Single-level .letra-link at root (externalized)
	if (result === null) {
		const linked = readLinkTarget(root);
		if (linked) {
			result = linked.dataDir;
		}
	}

	// 3. Legacy local layout: root contains a .letra/ subfolder
	if (result === null) {
		const localLetra = join(root, LETRA_FOLDER);
		if (existsSync(localLetra) && statSync(localLetra).isDirectory()) {
			result = localLetra;
		}
	}

	dataDirCache.set(root, result);
	return result;
}

/**
 * Always returns a usable data directory string (never null).
 * Falls back to `join(root, ".letra")` as a last resort so that workspace
 * initialization flows (which pass a not-yet-existing directory) can proceed.
 */
export function getLetraDir(root: string): string {
	const direct = resolveDataDir(root);
	if (direct) return direct;
	try {
		return resolveWorkspaceRoot(root).workspaceDir;
	} catch {
		return join(root, LETRA_FOLDER);
	}
}

/**
 * Resolve the workflow data directory, throwing if no workspace is found.
 */
export function getDataRoot(root?: string): string {
	const dir = resolveDataDir(root ?? process.cwd());
	if (!dir) {
		throw new Error(
			`No Letra workspace found from "${root ?? process.cwd()}". Ensure you are inside a workspace with a .letra-link or .letra directory, or run 'letra init'.`,
		);
	}
	return dir;
}

/**
 * Get the absolute path to the workflow.json file given a starting root.
 */
export function getWorkflowPath(root: string): string {
	return join(getLetraDir(root), "workflow.json");
}

export function getSpecsDir(root: string): string {
	return join(getLetraDir(root), "specs");
}

export function getDecisionsDir(root: string): string {
	return join(getLetraDir(root), "decisions");
}

export function getSessionLogPath(root: string): string {
	return join(getLetraDir(root), "session-log.json");
}

export function getHealthRecordPath(root: string): string {
	return join(getLetraDir(root), "health-record.json");
}

export function getFocusPath(root: string): string {
	return join(getLetraDir(root), "focus.md");
}

export function getConfigPath(root: string): string {
	return join(getLetraDir(root), "letra.config.json");
}

export function isWorkspaceMode(resolution: WorkspaceResolution): boolean {
	return (
		resolution.type === "linked" ||
		resolution.type === "env" ||
		resolution.type === "flag" ||
		resolution.type === "direct"
	);
}

export function isLinkedMode(resolution: WorkspaceResolution): boolean {
	return resolution.type === "linked";
}

export async function ensureWorkspaceDir(resolution: WorkspaceResolution): Promise<string> {
	const dir = resolution.workspaceDir;
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}
