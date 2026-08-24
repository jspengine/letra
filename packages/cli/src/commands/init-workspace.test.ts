import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const LINK_FILE = ".letra-link";
const LETRA_FOLDER = ".letra";
const CANONICAL_WORKSPACE_DIRS = [
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
const CANONICAL_WORKSPACE_FILES = [
	"workflow.json",
	"workspace.json",
	"context.md",
	"focus.md",
	"constitution.md",
	"constraints.md",
	"glossary.md",
] as const;

describe("init --workspace", () => {
	let tmpRoot: string | null = null;

	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("node:os");
		if (tmpRoot && existsSync(tmpRoot)) {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
		tmpRoot = null;
	});

	it("creates an external data directory and links the selected project folder", async () => {
		tmpRoot = join(tmpdir(), `letra-init-workspace-${Date.now()}`);
		const homeDir = join(tmpRoot, "home");
		const projectDir = join(tmpRoot, "project-a");

		const actualOs = await vi.importActual<typeof import("node:os")>("node:os");
		vi.doMock("node:os", () => ({
			...actualOs,
			homedir: () => homeDir,
		}));

		const { init } = await import("./init.js");
		await init(projectDir, { workspace: "Meu Produto" });

		const dataDir = join(homeDir, ".letra", "workspaces", "meu-produto");
		expect(existsSync(dataDir)).toBe(true);
		expect(existsSync(join(projectDir, LINK_FILE))).toBe(true);
		expect(readFileSync(join(projectDir, LINK_FILE), "utf-8").trim()).toBe(dataDir);
		expect(existsSync(join(projectDir, LETRA_FOLDER))).toBe(false);
		expect(existsSync(join(projectDir, "letra.manifest.json"))).toBe(false);

		for (const dir of CANONICAL_WORKSPACE_DIRS) {
			expect(existsSync(join(dataDir, dir))).toBe(true);
		}
		for (const file of CANONICAL_WORKSPACE_FILES) {
			expect(existsSync(join(dataDir, file))).toBe(true);
		}

		const workflow = JSON.parse(readFileSync(join(dataDir, "workflow.json"), "utf-8"));
		expect(workflow.locations).toEqual([
			{
				id: expect.stringMatching(/^loc-/),
				path: projectDir.replace(/\\/g, "/"),
				label: "project-a",
				adapters: [],
			},
		]);
	});
});
