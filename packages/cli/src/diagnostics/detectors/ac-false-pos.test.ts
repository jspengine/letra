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

	function createSourceFile(content: string) {
		const srcDir = join(tmpDir, "packages", "cli", "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(join(srcDir, "test-file.ts"), content);
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
