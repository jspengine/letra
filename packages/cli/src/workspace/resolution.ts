import { existsSync, mkdirSync, readdirSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getLetraDir as getHomeLetraDir } from "./index.js";

/**
 * Directory (within the user's home base, e.g. ~/.letra/) where the default
 * harness templates ship from, relative to this compiled module.
 * At runtime this resolves to `dist/harness/default/{version}`; during tests
 * (vitest) it resolves to `src/harness/default/{version}`.
 */
function getDefaultHarnessSource(version: string): string {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		// bundled CLI: dist/index.js → dist/harness/default/{version}
		join(moduleDir, "harness", "default", version),
		// sources (vitest): src/workspace/resolution.ts → src/harness/default/{version}
		join(moduleDir, "..", "harness", "default", version),
	];
	return candidates.find((candidate) => isHarnessDir(candidate)) ?? candidates[0];
}

/** A harness directory is usable only when it ships at least one flow. */
export function isHarnessDir(path: string): boolean {
	return existsSync(join(path, "flows"));
}

/**
 * Absolute path to the shared harness for a version:
 *   ~/.letra/shared-harness/{version}/
 * This is the externalized location shared across all workspaces once the
 * `.letra/` directory has been externalized (ITEM-78/ITEM-79).
 */
export function getHarnessPath(version: string): string {
	return join(getHomeLetraDir(), "shared-harness", version);
}

/** Absolute path to the legacy (pre-externalization) shared harness. */
export function getLegacyHarnessPath(version: string): string {
	return join(getHomeLetraDir(), "harness", version);
}

/**
 * Ensure the shared harness directory for `version` exists, bootstrapping it
 * from the default harness shipped with the CLI on first use. Returns the
 * resolved shared harness path.
 */
export function ensureSharedHarness(version: string): string {
	const harnessPath = getHarnessPath(version);
	// An empty directory left by an earlier failed bootstrap is repaired, not trusted.
	if (isHarnessDir(harnessPath)) return harnessPath;
	const source = getDefaultHarnessSource(version);
	if (!isHarnessDir(source)) return harnessPath;
	mkdirSync(harnessPath, { recursive: true });
	for (const entry of readdirSync(source)) {
		cpSync(join(source, entry), join(harnessPath, entry), { recursive: true, force: true });
	}
	return harnessPath;
}

/**
 * Returns the harness directory to use for `version`, preferring the
 * externalized shared-harness location, falling back to the legacy one.
 */
export function resolveHarnessPath(version: string): string {
	const shared = getHarnessPath(version);
	return existsSync(shared) ? shared : getLegacyHarnessPath(version);
}
