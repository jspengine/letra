import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acFalsePosDetector } from "./ac-false-pos.js";
import { init } from "../../commands/init.js";

describe("ac-false-pos detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-ac-false-pos-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	async function initProject() {
		await init(tmpDir);
	}

	async function createSpec(name: string, accs: string[]) {
		const specDir = join(tmpDir, ".letra", "specs", name);
		mkdirSync(specDir, { recursive: true });
		const spec = `# Spec: ${name}

## Outcome
Test spec for ac-false-pos detection.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
${accs.join("\n")}

## Context
Testing only.
`;
		writeFileSync(join(specDir, "spec.md"), spec);
	}

	function createSourceFile(content: string, ext = ".ts") {
		const srcDir = join(tmpDir, "packages", "cli", "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(join(srcDir, `test-file${ext}`), content);
	}

	it("should not flag ACs that have matching source code", async () => {
		await initProject();
		await createSpec("my-feature", ["- [x] **`myFunction`**"]);
		createSourceFile("function myFunction() { return true; }");

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should flag ACs marked [x] but missing from source", async () => {
		await initProject();
		await createSpec("my-feature", ["- [x] **`missingFunc`**"]);

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toContain("ac-false-pos_my-feature_missingFunc");
		expect(results[0].certainty).toBe(0.7);
		expect(results[0].detector).toBe("ac-false-pos");
	});

	it("should not flag unchecked ACs ([ ])", async () => {
		await initProject();
		await createSpec("my-feature", ["- [ ] **`pendingFunc`**"]);

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect camelCase and PascalCase variants", async () => {
		await initProject();
		await createSpec("my-feature", ["- [x] **`parse data`**"]);
		createSourceFile("function parseData() { return 1; }");

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect kebab-case and snake_case variants", async () => {
		await initProject();
		await createSpec("my-feature", ["- [x] **`my function`**"]);
		createSourceFile("const my_function = 42;");

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect base command name from multi-word commands", async () => {
		await initProject();
		await createSpec("commands", ["- [x] **`letra init`**"]);
		createSourceFile('.command("init")');

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect command with flags by extracting base command", async () => {
		await initProject();
		await createSpec("commands", ["- [x] **`flow init --quick`**"]);
		createSourceFile('.command("init [path]")');

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect API endpoints by path segments", async () => {
		await initProject();
		await createSpec("api", ["- [x] **`GET /api/workflow`**"]);
		createSourceFile('.get("/api/workflow")');

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect commands in JSON files", async () => {
		await initProject();
		await createSpec("config", ["- [x] **`npm run dev`**"]);
		createSourceFile('{"scripts": {"dev": "vite"}}', ".json");

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect split-line subcommands like backlog list", async () => {
		await initProject();
		await createSpec("commands", ["- [x] **`flow backlog list`**"]);
		createSourceFile('const backlog = cmd.command("backlog");\nbacklog.command("list")');

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should handle multiple ACs in one spec", async () => {
		await initProject();
		await createSpec("multi", [
			"- [x] **`implemented`**",
			"- [x] **`missing`**",
			"- [x] **`alsoMissing`**",
		]);
		createSourceFile("const implemented = 42;");

		const results = await acFalsePosDetector.run(tmpDir);
		expect(results).toHaveLength(2);
		expect(results[0].id).toContain("missing");
		expect(results[1].id).toContain("alsoMissing");
	});
});
