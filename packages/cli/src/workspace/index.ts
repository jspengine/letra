import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

export function getLetraDir(): string {
	return join(homedir(), ".letra");
}

export function getWorkspacesDir(): string {
	return join(getLetraDir(), "workspaces");
}

export function getHarnessDir(): string {
	return join(getLetraDir(), "harness");
}

export function getWorkspacePath(name: string): string {
	return join(getWorkspacesDir(), name);
}

export const CANONICAL_WORKSPACE_DIRS = [
	"harness",
	"specs",
	"decisions",
	"memories",
	"adapters",
	"operations",
	"session-log",
	"reports",
	"cache",
] as const;

export const CANONICAL_WORKSPACE_FILES = [
	"workflow.json",
	"workspace.json",
	"context.md",
	"focus.md",
	"constitution.md",
	"constraints.md",
	"glossary.md",
] as const;

export function ensureLetraDirs(): void {
	mkdirSync(getWorkspacesDir(), { recursive: true });
	mkdirSync(getHarnessDir(), { recursive: true });
}

export interface WorkspaceInfo {
	id: string;
	name: string;
	createdAt: string;
	templateId: string;
	harnessVersion: string;
}

export interface Manifest {
	schemaVersion: string;
	projectId: string;
	workspaceId: string;
	templateId: string;
	harnessVersion: string;
	repositories: Array<{ id: string; path: string }>;
	gates: string[];
}

function copyDir(src: string, dest: string): void {
	mkdirSync(dest, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		const s = join(src, entry.name);
		const d = join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(s, d);
		} else {
			copyFileSync(s, d);
		}
	}
}

export function slugifyWorkspaceName(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64) || "workspace";
}

export function ensureExternalWorkspaceLayout(workspaceDir: string, defaults?: {
	workspace?: Record<string, unknown>;
	workflow?: Record<string, unknown>;
}): void {
	mkdirSync(workspaceDir, { recursive: true });
	for (const dir of CANONICAL_WORKSPACE_DIRS) {
		mkdirSync(join(workspaceDir, dir), { recursive: true });
	}

	const fallbackFiles: Record<string, string> = {
		"workflow.json": JSON.stringify(defaults?.workflow ?? {
			version: "1.0",
			name: "Workspace",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [],
			items: [],
			tools: [],
		}, null, 2),
		"workspace.json": JSON.stringify(defaults?.workspace ?? {}, null, 2),
		"context.md": "# Context\n",
		"focus.md": "# Focus\n",
		"constitution.md": "# Constitution\n",
		"constraints.md": "# Constraints\n",
		"glossary.md": "# Glossary\n",
	};
	for (const file of CANONICAL_WORKSPACE_FILES) {
		const path = join(workspaceDir, file);
		if (!existsSync(path)) writeFileSync(path, fallbackFiles[file], "utf-8");
	}
}

function harnessDefaultDir(version: string): string {
	const candidates = [
		join(fileURLToPath(new URL(".", import.meta.url)), "..", "harness", "default", version),
		join(fileURLToPath(new URL(".", import.meta.url)), "harness", "default", version),
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return candidates[0];
}

export function ensureDefaultHarness(version = "v0.1.0"): string {
	const dest = join(getHarnessDir(), version);
	if (existsSync(dest)) return dest;

	const src = harnessDefaultDir(version);
	if (!existsSync(src)) {
		throw new Error(`Default harness not found at ${src}`);
	}

	copyDir(src, dest);
	return dest;
}

export function initWorkspace(name: string): { workspaceDir: string; info: WorkspaceInfo } {
	ensureLetraDirs();

	const workspaceDir = getWorkspacePath(slugifyWorkspaceName(name));
	if (existsSync(workspaceDir)) {
		throw new Error(`Workspace "${name}" already exists at ${workspaceDir}`);
	}

	const workspaceId = `ws_${crypto.randomBytes(4).toString("hex")}`;
	const templateId = "sdlc";
	const harnessVersion = "v0.1.0";

	ensureDefaultHarness(harnessVersion);

	const info: WorkspaceInfo = {
		id: workspaceId,
		name,
		createdAt: new Date().toISOString(),
		templateId,
		harnessVersion,
	};
	ensureExternalWorkspaceLayout(workspaceDir, { workspace: info });

	return { workspaceDir, info };
}

export function generateManifest(workspaceName: string, projectDir: string): Manifest {
	const workspaceDir = getWorkspacePath(workspaceName);
	const infoPath = join(workspaceDir, "workspace.json");
	if (!existsSync(infoPath)) {
		throw new Error(`Workspace "${workspaceName}" not found at ${workspaceDir}`);
	}
	const info: WorkspaceInfo = JSON.parse(readFileSync(infoPath, "utf-8"));

	const relativePath = workspaceDir.startsWith(projectDir)
		? "." + workspaceDir.slice(projectDir.length).replace(/\\/g, "/")
		: workspaceDir.replace(/\\/g, "/");

	const manifest: Manifest = {
		schemaVersion: "1.0",
		projectId: `proj_${crypto.randomBytes(3).toString("hex")}`,
		workspaceId: info.id,
		templateId: info.templateId,
		harnessVersion: info.harnessVersion,
		repositories: [{ id: "repo_1", path: relativePath }],
		gates: ["human-approved-spec", "human-approved-code"],
	};

	writeFileSync(join(projectDir, "letra.manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
	return manifest;
}

export function detectManifest(cwd: string): { manifest: Manifest; path: string } | null {
	const candidates = [
		join(cwd, "letra.manifest.json"),
		join(cwd, ".letra", "manifest.json"),
	];
	for (const p of candidates) {
		if (existsSync(p)) {
			try {
				const manifest: Manifest = JSON.parse(readFileSync(p, "utf-8"));
				return { manifest, path: p };
			} catch {
				return null;
			}
		}
	}
	return null;
}

export function loadWorkspaceInfo(workspaceName: string): WorkspaceInfo | null {
	const p = join(getWorkspacePath(workspaceName), "workspace.json");
	if (!existsSync(p)) return null;
	return JSON.parse(readFileSync(p, "utf-8"));
}

export function listWorkspaces(): WorkspaceInfo[] {
	const dir = getWorkspacesDir();
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => loadWorkspaceInfo(e.name))
		.filter((w): w is WorkspaceInfo => w !== null);
}

export function resolveHarnessRootGlobal(version = "v0.1.0"): string {
	return join(getHarnessDir(), version);
}
