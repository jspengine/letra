import { existsSync, readFileSync } from "node:fs";
import { join, isAbsolute, resolve, dirname } from "node:path";
import { getWorkspacePath, detectManifest, getLetraDir, ensureLetraDirs } from "./index.js";

export interface WorkspaceResolution {
	workspaceDir: string;
	targetDir: string;
	workspaceRoot: string;
	/** @deprecated use workspaceRoot */
	projectRoot: string;
	type: "local" | "manifest" | "env" | "flag" | "linked";
}

const ENV_KEY = "LETRA_WORKSPACE";
const LINK_FILE = ".letra-link";

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

function getCwd(): string {
	return process.cwd();
}

function resolveDotLetraLink(dir: string): string | null {
	const linkPath = join(dir, LINK_FILE);
	if (!existsSync(linkPath)) return null;
	try {
		const target = readFileSync(linkPath, "utf-8").trim().split("\n")[0].trim();
		if (!target) return null;
		const resolved = isAbsolute(target) ? target : resolve(dir, target);
		const harnessDir = join(resolved, ".letra");
		return existsSync(harnessDir) ? harnessDir : null;
	} catch {
		return null;
	}
}

export function resolveWorkspaceRoot(cwd?: string): WorkspaceResolution {
	const dir = cwd ?? getCwd();

	const envWs = getEnvWorkspace();
	if (envWs) {
		const wsDir = getWorkspacePath(envWs);
		if (existsSync(join(wsDir, "workspace.json"))) {
			const workspaceRoot = dirname(wsDir);
			return { workspaceDir: wsDir, targetDir: dir, workspaceRoot, projectRoot: workspaceRoot, type: "env" };
		}
	}

	const flagWs = getFlagWorkspace();
	if (flagWs) {
		const wsDir = getWorkspacePath(flagWs);
		if (existsSync(join(wsDir, "workspace.json"))) {
			const workspaceRoot = dirname(wsDir);
			return { workspaceDir: wsDir, targetDir: dir, workspaceRoot, projectRoot: workspaceRoot, type: "flag" };
		}
	}

	const linkedHarness = resolveDotLetraLink(dir);
	if (linkedHarness) {
		const workspaceRoot = dirname(linkedHarness);
		return { workspaceDir: linkedHarness, targetDir: dir, workspaceRoot, projectRoot: workspaceRoot, type: "linked" };
	}

	const manifest = detectManifest(dir);
	if (manifest) {
		const wsDir = getWorkspacePath(manifest.manifest.workspaceId);
		if (existsSync(join(wsDir, "workspace.json"))) {
			const workspaceRoot = dirname(wsDir);
			return { workspaceDir: wsDir, targetDir: dir, workspaceRoot, projectRoot: workspaceRoot, type: "manifest" };
		}
		const wsName = manifest.manifest.projectId;
		const fallback = getWorkspacePath(wsName);
		if (existsSync(join(fallback, "workspace.json"))) {
			const workspaceRoot = dirname(fallback);
			return { workspaceDir: fallback, targetDir: dir, workspaceRoot, projectRoot: workspaceRoot, type: "manifest" };
		}
	}

	if (existsSync(join(dir, ".letra"))) {
		return { workspaceDir: join(dir, ".letra"), targetDir: dir, workspaceRoot: dir, projectRoot: dir, type: "local" };
	}

	return { workspaceDir: join(dir, ".letra"), targetDir: dir, workspaceRoot: dir, projectRoot: dir, type: "local" };
}

export function getWorkflowPath(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "workflow.json");
}

export function getSpecsDir(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "specs");
}

export function getDecisionsDir(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "decisions");
}

export function getSessionLogPath(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "session-log.json");
}

export function getHealthRecordPath(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "health-record.json");
}

export function getFocusPath(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "focus.md");
}

export function getConfigPath(resolution: WorkspaceResolution): string {
	return join(resolution.workspaceDir, "config.json");
}

export function isWorkspaceMode(resolution: WorkspaceResolution): boolean {
	return resolution.type !== "local";
}

export function isLinkedMode(resolution: WorkspaceResolution): boolean {
	return resolution.type === "linked";
}

export function ensureWorkspaceDir(resolution: WorkspaceResolution): void {
	ensureLetraDirs();
	if (!existsSync(resolution.workspaceDir)) {
		const { mkdirSync } = require("node:fs");
		mkdirSync(resolution.workspaceDir, { recursive: true });
	}
}
