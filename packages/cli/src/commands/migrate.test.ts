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
		const evidence = JSON.parse(
			readFileSync(join(target, "operations", "migrations", evidenceFiles[0]), "utf-8"),
		);
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

	it("dry-run for linked workspaces reports cleanup without copying or deleting", async () => {
		const root = makeTmp("letra-linked-dry");
		const target = makeTmp("letra-linked-data");
		writeFileSync(join(target, "workflow.json"), JSON.stringify(wf("Linked")));
		writeFileSync(join(root, LINK_FILE), `${target}\n`);
		mkdirSync(join(root, LETRA_FOLDER, "specs", "legacy"), { recursive: true });
		writeFileSync(join(root, LETRA_FOLDER, "specs", "legacy", "spec.md"), "legacy spec");

		const result = await migrateWorkspace(root, { clean: true, dryRun: true });
		expect(result.ok).toBe(true);
		expect(result.message).toContain("Would snapshot project-legacy .letra");
		expect(existsSync(join(target, "specs", "legacy", "spec.md"))).toBe(false);
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(true);
	});

	it("snapshots, copies missing data, verifies equality, then cleans linked legacy data", async () => {
		const root = makeTmp("letra-linked-clean");
		const target = makeTmp("letra-linked-clean-data");
		writeFileSync(join(target, "workflow.json"), JSON.stringify(wf("Linked")));
		writeFileSync(join(root, LINK_FILE), `${target}\n`);
		mkdirSync(join(root, LETRA_FOLDER, "specs", "legacy"), { recursive: true });
		writeFileSync(join(root, LETRA_FOLDER, "specs", "legacy", "spec.md"), "legacy spec");

		const result = await migrateWorkspace(root, { clean: true });
		expect(result.ok).toBe(true);
		expect(result.cleaned).toBe(true);
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(false);
		expect(readFileSync(join(target, "specs", "legacy", "spec.md"), "utf8")).toBe("legacy spec");
		const rollbacks = readdirSync(join(target, "operations", "rollbacks"));
		expect(rollbacks).toHaveLength(1);
		const snapshot = join(target, "operations", "rollbacks", rollbacks[0], "legacy-letra", "specs", "legacy", "spec.md");
		expect(readFileSync(snapshot, "utf8")).toBe("legacy spec");
	});

	it("preserves divergent legacy files in the rollback snapshot while external data stays canonical", async () => {
		const root = makeTmp("letra-linked-conflict");
		const target = makeTmp("letra-linked-conflict-data");
		writeFileSync(join(target, "workflow.json"), JSON.stringify(wf("Linked")));
		mkdirSync(join(target, "specs", "legacy"), { recursive: true });
		mkdirSync(join(root, LETRA_FOLDER, "specs", "legacy"), { recursive: true });
		writeFileSync(join(root, LINK_FILE), `${target}\n`);
		writeFileSync(join(target, "specs", "legacy", "spec.md"), "external version");
		writeFileSync(join(root, LETRA_FOLDER, "specs", "legacy", "spec.md"), "local version");

		const result = await migrateWorkspace(root, { clean: true });
		expect(result.ok).toBe(true);
		expect(result.cleaned).toBe(true);
		expect(readFileSync(join(target, "specs", "legacy", "spec.md"), "utf8")).toBe("external version");
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(false);
		const rollbacks = readdirSync(join(target, "operations", "rollbacks"));
		const snapshot = join(target, "operations", "rollbacks", rollbacks[0], "legacy-letra", "specs", "legacy", "spec.md");
		expect(readFileSync(snapshot, "utf8")).toBe("local version");
		const evidencePath = join(target, "operations", "migrations", readdirSync(join(target, "operations", "migrations"))[0]);
		expect(JSON.parse(readFileSync(evidencePath, "utf8"))).toMatchObject({
			canonicalTarget: target,
			conflicts: ["specs/legacy/spec.md"],
			conflictPolicy: "preserve-in-snapshot; canonical-target-wins",
		});
	});

	it("dry-run reports divergent files without copying or deleting either version", async () => {
		const root = makeTmp("letra-linked-dry-conflict");
		const target = makeTmp("letra-linked-dry-conflict-data");
		writeFileSync(join(target, "workflow.json"), JSON.stringify(wf("Linked")));
		mkdirSync(join(target, "specs", "legacy"), { recursive: true });
		mkdirSync(join(root, LETRA_FOLDER, "specs", "legacy"), { recursive: true });
		writeFileSync(join(root, LINK_FILE), `${target}\n`);
		writeFileSync(join(target, "specs", "legacy", "spec.md"), "external version");
		writeFileSync(join(root, LETRA_FOLDER, "specs", "legacy", "spec.md"), "local version");

		const result = await migrateWorkspace(root, { clean: true, dryRun: true });
		expect(result.ok).toBe(true);
		expect(result.message).toContain("keeping");
		expect(result.message).toContain("specs/legacy/spec.md");
		expect(readFileSync(join(target, "specs", "legacy", "spec.md"), "utf8")).toBe("external version");
		expect(readFileSync(join(root, LETRA_FOLDER, "specs", "legacy", "spec.md"), "utf8")).toBe("local version");
		expect(existsSync(join(target, "operations", "rollbacks"))).toBe(false);
	});

	it("cleans a nested projection in a direct canonical workspace, preserving a rollback snapshot", async () => {
		const root = makeTmp("letra-direct-projection");
		writeFileSync(join(root, "workflow.json"), JSON.stringify(wf("Canonical")));
		mkdirSync(join(root, "specs", "canonical"), { recursive: true });
		writeFileSync(join(root, "specs", "canonical", "spec.md"), "canonical version");
		mkdirSync(join(root, LETRA_FOLDER, "specs", "canonical"), { recursive: true });
		mkdirSync(join(root, LETRA_FOLDER, "patches"), { recursive: true });
		writeFileSync(join(root, LETRA_FOLDER, "specs", "canonical", "spec.md"), "stale projection");
		writeFileSync(join(root, LETRA_FOLDER, "patches", "history.json"), "historical data");

		const dryRun = await migrateWorkspace(root, { clean: true, dryRun: true });
		expect(dryRun.ok).toBe(true);
		expect(dryRun.message).toContain("workspace-projection");
		expect(dryRun.message).toContain("specs/canonical/spec.md");
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(true);
		expect(existsSync(join(root, "operations"))).toBe(false);

		const result = await migrateWorkspace(root, { clean: true });
		expect(result.ok).toBe(true);
		expect(result.cleaned).toBe(true);
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(false);
		expect(readFileSync(join(root, "specs", "canonical", "spec.md"), "utf8")).toBe("canonical version");
		const evidenceFile = readdirSync(join(root, "operations", "migrations")).find((file) => file.startsWith("cleanup-workspace-projection-"));
		expect(evidenceFile).toBeDefined();
		const evidencePath = join(root, "operations", "migrations", evidenceFile!);
		const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
		expect(evidence).toMatchObject({
			kind: "workspace-projection",
			canonicalTarget: root,
			conflicts: ["specs/canonical/spec.md"],
			copiedPaths: ["patches"],
		});
		expect(readFileSync(join(evidence.rollbackSnapshotPath, "specs", "canonical", "spec.md"), "utf8")).toBe("stale projection");
		expect(readFileSync(join(root, "patches", "history.json"), "utf8")).toBe("historical data");
	});
});
