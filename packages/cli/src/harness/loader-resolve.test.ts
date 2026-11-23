import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VERSION = "v0.2.0";

describe("harness resolution", () => {
	let sandbox: string;
	let home: string;
	let project: string;

	beforeEach(() => {
		sandbox = mkdtempSync(join(tmpdir(), "letra-harness-resolve-"));
		home = join(sandbox, "home");
		project = join(sandbox, "project");
		mkdirSync(join(project, ".letra", "harness"), { recursive: true });
		vi.resetModules();
		vi.doMock("node:os", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:os")>();
			return { ...actual, homedir: () => home };
		});
	});

	afterEach(() => {
		vi.doUnmock("node:os");
		vi.resetModules();
		rmSync(sandbox, { recursive: true, force: true });
	});

	/** Creates a usable harness (with a flows/ directory) and returns its root. */
	function harnessAt(...segments: string[]): string {
		const root = join(...segments);
		mkdirSync(join(root, "flows"), { recursive: true });
		return root;
	}

	async function loadResolver() {
		return (await import("./loader.js")).resolveHarnessRoot;
	}

	describe("resolveHarnessRoot", () => {
		it("prefers the workspace-local harness when it exists", async () => {
			const local = harnessAt(project, ".letra", "harness", VERSION);
			harnessAt(home, ".letra", "shared-harness", VERSION);

			expect((await loadResolver())(project, VERSION)).toBe(local);
		});

		it("falls back to the shared harness when the workspace has none", async () => {
			const shared = harnessAt(home, ".letra", "shared-harness", VERSION);

			expect((await loadResolver())(project, VERSION)).toBe(shared);
		});

		it("falls back to the legacy harness installed by init", async () => {
			const legacy = harnessAt(home, ".letra", "harness", VERSION);

			expect((await loadResolver())(project, VERSION)).toBe(legacy);
		});

		it("prefers the shared harness over the legacy one when both exist", async () => {
			const shared = harnessAt(home, ".letra", "shared-harness", VERSION);
			harnessAt(home, ".letra", "harness", VERSION);

			expect((await loadResolver())(project, VERSION)).toBe(shared);
		});

		it("skips an empty shared harness directory instead of shadowing the legacy one", async () => {
			mkdirSync(join(home, ".letra", "shared-harness", VERSION), { recursive: true });
			const legacy = harnessAt(home, ".letra", "harness", VERSION);

			expect((await loadResolver())(project, VERSION)).toBe(legacy);
		});

		it("keeps returning the local candidate when no harness exists anywhere", async () => {
			expect((await loadResolver())(project, VERSION)).toBe(
				join(project, ".letra", "harness", VERSION),
			);
		});
	});

	describe("ensureSharedHarness", () => {
		it("repairs an empty shared harness left by an earlier failed bootstrap", async () => {
			const shared = join(home, ".letra", "shared-harness", VERSION);
			mkdirSync(shared, { recursive: true });

			const { ensureSharedHarness } = await import("../workspace/resolution.js");

			expect(ensureSharedHarness(VERSION)).toBe(shared);
			expect(existsSync(join(shared, "flows"))).toBe(true);
			expect(readdirSync(join(shared, "flows")).length).toBeGreaterThan(0);
		});
	});
});
