import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { harnessStaleDetector } from "./harness-stale.js";

describe("harness-stale detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-harness-stale-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	function writeWorkflow(tools: string[]) {
		const wfDir = join(tmpDir, ".letra");
		mkdirSync(wfDir, { recursive: true });
		writeFileSync(
			join(wfDir, "workflow.json"),
			JSON.stringify({
				name: "test",
				stages: [{ id: "code", name: "Code", zone: "doing" }],
				items: [{ id: "ITEM-1", description: "test", stage: "code" }],
				tools,
			}),
		);
	}

	// "Current" means the stable bootstrap that sends agents to the live
	// direction; the legacy L1 references alone no longer make an adapter current.
	function writeAdapter(path: string, isCurrent: boolean) {
		const fullPath = join(tmpDir, path);
		mkdirSync(join(fullPath, ".."), { recursive: true });
		if (isCurrent) {
			writeFileSync(
				fullPath,
				"# Letra Agent Bootstrap\n\n1. Query `get_direction` or run `letra direction --json` before acting.\n",
			);
		} else {
			writeFileSync(fullPath, "# Adapter\n\nNo references here.\n");
		}
	}

	it("should detect stale adapters (no L1 refs)", async () => {
		writeWorkflow(["cursor", "opencode", "vscode"]);
		writeAdapter(".cursorrules", false);
		writeAdapter("AGENTS.md", false);
		writeAdapter(".github/copilot-instructions.md", false);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("harness-stale_all");
		expect(results[0].certainty).toBe(1.0);
		expect(results[0].autoFix).toBeDefined();
	});

	it("should not detect when adapters have L1 refs", async () => {
		writeWorkflow(["cursor", "opencode", "codex"]);
		writeAdapter(".cursorrules", true);
		writeAdapter("AGENTS.md", true);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should ignore tools not in ADAPTER_FILES", async () => {
		writeWorkflow(["unknown-tool"]);
		writeAdapter("AGENTS.md", false);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should partially detect when only some adapters are stale", async () => {
		writeWorkflow(["cursor", "opencode", "vscode"]);
		writeAdapter(".cursorrules", false);
		writeAdapter("AGENTS.md", true);
		writeAdapter(".github/copilot-instructions.md", false);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(1);
	});

	it("flags legacy adapters that only carry L1 refs", async () => {
		writeWorkflow(["opencode"]);
		writeFileSync(
			join(tmpDir, "AGENTS.md"),
			"# Adapter\n\nRead:\n- .letra/context.md\n- .letra/constitution.md\n",
		);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(1);
	});

	it("autoFix regenerates the bootstrap and clears the alert", async () => {
		writeWorkflow(["cursor", "opencode"]);
		writeAdapter(".cursorrules", false);
		writeAdapter("AGENTS.md", false);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].autoFix).toBeDefined();

		const fixFn = results[0].autoFix!;
		const applied = await fixFn();
		expect(applied.files.length).toBeGreaterThan(0);

		for (const file of applied.files) {
			expect(file.before).toContain("No references here");
			expect(file.after).toContain("# Letra Agent Bootstrap");
			expect(file.after).toContain("letra direction --json");
		}

		const cursorContent = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
		expect(cursorContent).toContain("# Letra Agent Bootstrap");

		const agentsContent = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
		expect(agentsContent).toContain("# Letra Agent Bootstrap");

		// The regenerated adapters must satisfy the detector, so the alert does
		// not come back on the next scan.
		expect(await harnessStaleDetector.run(tmpDir)).toHaveLength(0);
	});

	it("autoFix should not modify adapters that were already fresh", async () => {
		writeWorkflow(["cursor", "opencode"]);
		writeAdapter(".cursorrules", false);
		writeAdapter("AGENTS.md", true);

		const results = await harnessStaleDetector.run(tmpDir);
		expect(results).toHaveLength(1);

		const fixFn = results[0].autoFix!;
		const applied = await fixFn();
		const cursorFile = applied.files.find((f) => f.path === ".cursorrules");
		const agentsFile = applied.files.find((f) => f.path === "AGENTS.md");
		expect(cursorFile).toBeDefined();
		expect(cursorFile?.before).not.toBe(cursorFile?.after);
		expect(agentsFile).toBeUndefined();
	});
});
