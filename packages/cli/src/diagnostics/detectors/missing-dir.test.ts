import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DiagnosticEngine } from "../engine.js";
import { missingDirDetector } from "./missing-dir.js";

const roots: string[] = [];

function tempRoot() {
	const root = mkdtempSync(join(tmpdir(), "letra-missing-dir-"));
	roots.push(root);
	return root;
}

function linkedWorkspace() {
	const root = tempRoot();
	const projectDir = join(root, "project");
	const dataDir = join(root, "data");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(dataDir, { recursive: true });
	writeFileSync(join(dataDir, "workflow.json"), JSON.stringify({
		version: "1.0",
		name: "Linked",
		stages: [],
		items: [],
		tools: [],
	}), "utf-8");
	writeFileSync(join(projectDir, ".letra-link"), `${dataDir}\n`, "utf-8");
	return { projectDir, dataDir };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("missing-dir detector", () => {
	it("creates required directories in the linked dataDir instead of the project", async () => {
		const { projectDir, dataDir } = linkedWorkspace();
		const results = await missingDirDetector.run(projectDir);

		expect(results.map((result) => result.id)).toEqual([
			"missing-dir_templates",
			"missing-dir_brand",
		]);

		await results[0].autoFix?.();

		expect(existsSync(join(dataDir, "templates"))).toBe(true);
		expect(existsSync(join(dataDir, "brand"))).toBe(true);
		expect(existsSync(join(projectDir, ".letra"))).toBe(false);
	});
});

describe("DiagnosticEngine.ensureDirs", () => {
	it("keeps operational directories in the linked dataDir", () => {
		const { projectDir, dataDir } = linkedWorkspace();

		new DiagnosticEngine(projectDir).ensureDirs();

		expect(existsSync(join(dataDir, "templates"))).toBe(true);
		expect(existsSync(join(dataDir, "brand"))).toBe(true);
		expect(existsSync(join(dataDir, "snapshots"))).toBe(true);
		expect(existsSync(join(projectDir, ".letra"))).toBe(false);
	});
});
