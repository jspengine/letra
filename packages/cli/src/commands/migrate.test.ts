import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { migrateWorkspace } from "./migrate.js";
import { loadWorkflow } from "./flow-init.js";
import { resolveWorkspaceRoot, LINK_FILE, LETRA_FOLDER } from "../workspace/resolver.js";
import { CANONICAL_WORKSPACE_DIRS, CANONICAL_WORKSPACE_FILES } from "../workspace/index.js";

const dirs: string[] = [];
function makeTmp(prefix: string): string {
	const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	dirs.push(dir);
	return dir;
}
function wf(name: string) {
	return { version: "1.0", name, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", stages: [], items: [], tools: [], primaryItemId: null };
}
function seed(root: string, name: string) {
	mkdirSync(join(root, LETRA_FOLDER, "specs"), { recursive: true });
	writeFileSync(join(root, LETRA_FOLDER, "workflow.json"), JSON.stringify(wf(name)));
}

afterEach(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
	dirs.length = 0;
});

describe("migrate (externalize workspace, ITEM-79)", () => {
	it("moves data to an external target and writes .letra-link pointing to it", async () => {
		const root = makeTmp("letra-migrate");
		seed(root, "Demo Workspace");
		const target = makeTmp("letra-migrate-target");
		rmSync(target, { recursive: true, force: true });

		const result = await migrateWorkspace(root, { to: target, clean: true });
		expect(result.ok).toBe(true);
		expect(existsSync(join(target, "workflow.json"))).toBe(true);

		// Link written at workspace root (where .letra used to live)
		const linkPath = join(root, LINK_FILE);
		expect(existsSync(linkPath)).toBe(true);
		expect(readFileSync(linkPath, "utf-8").trim()).toBe(target);

		// Original data dir removed by --clean
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(false);
		for (const dir of CANONICAL_WORKSPACE_DIRS) {
			expect(existsSync(join(target, dir))).toBe(true);
		}
		for (const file of CANONICAL_WORKSPACE_FILES) {
			expect(existsSync(join(target, file))).toBe(true);
		}
		const evidenceFiles = readdirSync(join(target, "operations", "migrations"));
		expect(evidenceFiles).toHaveLength(1);
		const evidence = JSON.parse(readFileSync(join(target, "operations", "migrations", evidenceFiles[0]), "utf-8"));
		expect(evidence).toMatchObject({
			from: join(root, LETRA_FOLDER),
			to: target,
			cleaned: true,
		});
		expect(existsSync(evidence.rollbackSnapshotPath)).toBe(true);
		expect(existsSync(join(evidence.rollbackSnapshotPath, "workflow.json"))).toBe(true);
		expect(existsSync(evidence.rollbackManifestPath)).toBe(true);
		const rollbackManifest = JSON.parse(readFileSync(evidence.rollbackManifestPath, "utf-8"));
		expect(rollbackManifest).toMatchObject({
			source: join(root, LETRA_FOLDER),
			target,
			snapshotPath: evidence.rollbackSnapshotPath,
		});

		// loadWorkflow now resolves through the link to the external dir
		const wf = loadWorkflow(root);
		expect(wf?.name).toBe("Demo Workspace");

		// resolveWorkspaceRoot sees it as linked/direct
		const res = resolveWorkspaceRoot(root);
		expect(res.type).toBe("linked");
		expect(res.workspaceDir).toBe(target);
		expect(res.dataDir).toBe(target);
	});

	it("refuses when target already has a workflow.json", async () => {
		const root = makeTmp("letra-migrate-conflict");
		seed(root, "A");
		const target = makeTmp("letra-migrate-conflict-target");
		writeFileSync(join(target, "workflow.json"), JSON.stringify(wf("Existing")));

		const result = await migrateWorkspace(root, { to: target });
		expect(result.ok).toBe(false);
		expect(result.message).toContain("already contains a workflow.json");
	});

	it("dry-run does not write anything", async () => {
		const root = makeTmp("letra-migrate-dry");
		seed(root, "Dry");
		const target = makeTmp("letra-migrate-dry-target");
		rmSync(target, { recursive: true, force: true });

		const result = await migrateWorkspace(root, { to: target, dryRun: true });
		expect(result.ok).toBe(true);
		expect(existsSync(target)).toBe(false);
		expect(existsSync(join(root, LINK_FILE))).toBe(false);
	});
});
