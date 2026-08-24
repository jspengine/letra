import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
	clearWorkspaceCache,
	resolveDataDir,
	getLetraDir,
	resolveWorkspaceRoot,
	isLinkedMode,
	LINK_FILE,
	LETRA_FOLDER,
} from "./resolver.js";
import { loadWorkflow } from "../commands/flow-init.js";

function makeTmp(prefix: string): string {
	const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function workflow(name: string) {
	return {
		version: "1.0",
		name,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [],
		items: [],
		tools: [],
		primaryItemId: null,
	};
}

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
	dirs.length = 0;
	clearWorkspaceCache();
});

describe("workspace resolution (externalized direct layout, ITEM-79)", () => {
	it("resolveDataDir follows a single-level link to the direct data directory", () => {
		const dataDir = makeTmp("letra-direct");
		dirs.push(dataDir);
		writeFileSync(join(dataDir, "workflow.json"), JSON.stringify(workflow("direct")));

		const workspaceRoot = makeTmp("letra-root");
		dirs.push(workspaceRoot);
		writeFileSync(join(workspaceRoot, LINK_FILE), `${dataDir}\n`);

		expect(resolveDataDir(workspaceRoot)).toBe(dataDir);
		expect(getLetraDir(workspaceRoot)).toBe(dataDir);
	});

	it("resolveWorkspaceRoot treats direct externalized data as linked layout", () => {
		const dataDir = makeTmp("letra-direct2");
		dirs.push(dataDir);
		writeFileSync(join(dataDir, "workflow.json"), JSON.stringify(workflow("direct2")));

		const workspaceRoot = makeTmp("letra-root2");
		dirs.push(workspaceRoot);
		writeFileSync(join(workspaceRoot, LINK_FILE), `${dataDir}\n`);

		const res = resolveWorkspaceRoot(workspaceRoot);
		expect(isLinkedMode(res)).toBe(true);
		expect(res.workspaceDir).toBe(dataDir);
		expect(res.dataDir).toBe(dataDir);
		expect(res.locationPath).toBe(workspaceRoot);
		expect(res.workspaceRoot).toBe(dataDir);
	});

	it("loadWorkflow reads the externalized workflow.json directly from dataDir", () => {
		const dataDir = makeTmp("letra-load");
		dirs.push(dataDir);
		writeFileSync(join(dataDir, "workflow.json"), JSON.stringify(workflow("external")));

		const workspaceRoot = makeTmp("letra-root-load");
		dirs.push(workspaceRoot);
		writeFileSync(join(workspaceRoot, LINK_FILE), `${dataDir}\n`);

		const wf = loadWorkflow(workspaceRoot);
		expect(wf?.name).toBe("external");
		expect(wf?.version).toBe("1.0");
	});

	it("resolveWorkspaceRoot accepts an external data directory opened directly", () => {
		const dataDir = makeTmp("letra-direct-open");
		dirs.push(dataDir);
		writeFileSync(join(dataDir, "workflow.json"), JSON.stringify(workflow("direct-open")));

		const res = resolveWorkspaceRoot(dataDir);

		expect(res.type).toBe("direct");
		expect(res.workspaceDir).toBe(dataDir);
		expect(res.dataDir).toBe(dataDir);
		expect(res.locationPath).toBe(dataDir);
	});

	it("getLetraDir walks up from spec subdirectories inside an external data directory", () => {
		const dataDir = makeTmp("letra-direct-nested-read");
		dirs.push(dataDir);
		const specDir = join(dataDir, "specs", "auth");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(dataDir, "workflow.json"),
			JSON.stringify(workflow("direct-nested-read")),
		);

		expect(getLetraDir(specDir)).toBe(dataDir);
		expect(existsSync(join(specDir, LETRA_FOLDER))).toBe(false);
	});

	it("falls back to legacy layout when no link file is present", () => {
		const workspaceRoot = makeTmp("letra-legacy");
		dirs.push(workspaceRoot);
		mkdirSync(join(workspaceRoot, LETRA_FOLDER, "specs"), { recursive: true });
		writeFileSync(
			join(workspaceRoot, LETRA_FOLDER, "workflow.json"),
			JSON.stringify(workflow("legacy")),
		);

		expect(resolveDataDir(workspaceRoot)).toBe(join(workspaceRoot, LETRA_FOLDER));
		expect(getLetraDir(workspaceRoot)).toBe(join(workspaceRoot, LETRA_FOLDER));
		const res = resolveWorkspaceRoot(workspaceRoot);
		expect(res.type).toBe("local");
		expect(res.dataDir).toBe(join(workspaceRoot, LETRA_FOLDER));
		expect(res.locationPath).toBe(workspaceRoot);
		expect(loadWorkflow(workspaceRoot)?.name).toBe("legacy");
	});

	it("does not materialize a new harness layout while resolving a legacy workspace", () => {
		const workspaceRoot = makeTmp("letra-legacy-no-write");
		dirs.push(workspaceRoot);
		mkdirSync(join(workspaceRoot, LETRA_FOLDER), { recursive: true });
		writeFileSync(
			join(workspaceRoot, LETRA_FOLDER, "workflow.json"),
			JSON.stringify(workflow("legacy-no-write")),
		);
		const rootEntriesBefore = readdirSync(workspaceRoot).sort();
		const letraEntriesBefore = readdirSync(join(workspaceRoot, LETRA_FOLDER)).sort();

		expect(resolveDataDir(workspaceRoot)).toBe(join(workspaceRoot, LETRA_FOLDER));
		expect(resolveWorkspaceRoot(workspaceRoot).type).toBe("local");
		expect(loadWorkflow(workspaceRoot)?.name).toBe("legacy-no-write");

		expect(readdirSync(workspaceRoot).sort()).toEqual(rootEntriesBefore);
		expect(readdirSync(join(workspaceRoot, LETRA_FOLDER)).sort()).toEqual(letraEntriesBefore);
	});

	it("supports externalized data dir that contains a nested folder subfolder", () => {
		const dataDir = makeTmp("letra-nested");
		dirs.push(dataDir);
		mkdirSync(join(dataDir, LETRA_FOLDER), { recursive: true });
		writeFileSync(
			join(dataDir, LETRA_FOLDER, "workflow.json"),
			JSON.stringify(workflow("nested")),
		);

		const workspaceRoot = makeTmp("letra-root-nested");
		dirs.push(workspaceRoot);
		writeFileSync(join(workspaceRoot, LINK_FILE), `${dataDir}\n`);

		const resolved = resolveDataDir(workspaceRoot);
		expect(resolved).toBe(join(dataDir, LETRA_FOLDER));
		expect(loadWorkflow(workspaceRoot)?.name).toBe("nested");
	});

	it("falls back to local .letra/ when .letra-link points to a missing data directory", () => {
		const workspaceRoot = makeTmp("letra-broken-link");
		dirs.push(workspaceRoot);
		const missing = join(workspaceRoot, "missing-data-dir");
		writeFileSync(join(workspaceRoot, LINK_FILE), `${missing}\n`);

		// Broken link should not throw — resolveDataDir returns null, getLetraDir falls back
		expect(resolveDataDir(workspaceRoot)).toBeNull();
		const fallback = getLetraDir(workspaceRoot);
		expect(typeof fallback).toBe("string");
		expect(fallback.length).toBeGreaterThan(0);
	});

	it("falls back to local .letra/ when linked data directory lacks workflow.json", () => {
		const dataDir = makeTmp("letra-empty-data");
		dirs.push(dataDir);
		const workspaceRoot = makeTmp("letra-empty-link");
		dirs.push(workspaceRoot);
		writeFileSync(join(workspaceRoot, LINK_FILE), `${dataDir}\n`);

		// Link target exists but has no workflow.json — should return null, not throw
		expect(resolveDataDir(workspaceRoot)).toBeNull();
	});
});
