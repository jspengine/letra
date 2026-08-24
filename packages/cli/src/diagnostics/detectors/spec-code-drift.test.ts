import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specCodeDriftDetector } from "./spec-code-drift.js";

describe("spec-code-drift detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-spec-code-drift-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	function writeWorkflow(items: { stage: string; spec?: string }[]) {
		const dir = join(tmpDir, ".letra");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "workflow.json"),
			JSON.stringify({
				version: "1.0",
				stages: [
					{ id: "backlog", name: "Backlog", order: 0 },
					{ id: "design", name: "Design", order: 1 },
					{ id: "code", name: "Code", order: 2 },
					{ id: "review", name: "Review", order: 3 },
					{ id: "done", name: "Done", order: 4 },
				],
				items: items.map((item, i) => ({
					id: `ITEM-${i + 1}`,
					description: `item ${i}`,
					stage: item.stage,
					spec: item.spec,
				})),
			}),
		);
	}

	function createSpec(name: string, accs: string[]) {
		const specDir = join(tmpDir, ".letra", "specs", name);
		mkdirSync(specDir, { recursive: true });
		const spec = `# Spec: ${name}

## Outcome
Test spec for spec-code-drift.

## Constraints
None.

## Acceptance Criteria
${accs.join("\n")}

## Context
Testing.
`;
		writeFileSync(join(specDir, "spec.md"), spec);
	}

	function createSourceFile(content: string) {
		const srcDir = join(tmpDir, "packages", "cli", "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(join(srcDir, "test-file.ts"), content);
	}

	it("should flag AC [x] with no matching source (item in code stage)", async () => {
		writeWorkflow([{ stage: "code", spec: "my-feature" }]);
		createSpec("my-feature", ["- [x] **`missingFunc`**"]);

		const results = await specCodeDriftDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toContain("spec-code-drift_my-feature_missingFunc");
		expect(results[0].certainty).toBe(0.7);
		expect(results[0].autoFix).toBeUndefined();
	});

	it("should NOT flag AC [x] with matching source code", async () => {
		writeWorkflow([{ stage: "code", spec: "my-feature" }]);
		createSpec("my-feature", ["- [x] **`existingFunc`**"]);
		createSourceFile("function existingFunc() { return true; }");

		const results = await specCodeDriftDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should ignore specs in design or backlog stage", async () => {
		writeWorkflow([
			{ stage: "design", spec: "design-spec" },
			{ stage: "backlog", spec: "backlog-spec" },
		]);
		createSpec("design-spec", ["- [x] **`missingInDesign`**"]);
		createSpec("backlog-spec", ["- [x] **`missingInBacklog`**"]);

		const results = await specCodeDriftDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should not flag unchecked ACs ([ ]) in active stages", async () => {
		writeWorkflow([{ stage: "code", spec: "my-feature" }]);
		createSpec("my-feature", ["- [ ] **`pendingFunc`**"]);

		const results = await specCodeDriftDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});
});
