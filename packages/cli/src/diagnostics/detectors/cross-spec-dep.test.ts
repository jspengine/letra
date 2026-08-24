import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crossSpecDepDetector } from "./cross-spec-dep.js";

describe("cross-spec-dep detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-cross-spec-dep-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	function createSpec(name: string, updatedAt: string, acs: string) {
		const specDir = join(tmpDir, ".letra", "specs", name);
		mkdirSync(specDir, { recursive: true });
		const content = `# Spec: ${name}
> Updated: ${updatedAt}

## Outcome
Test.

## Constraints
None.

## Acceptance Criteria
${acs}

## Context
Testing.
`;
		writeFileSync(join(specDir, "spec.md"), content);
	}

	function writeWorkflow(items: { id: string; spec: string }[]) {
		const dir = join(tmpDir, ".letra");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "workflow.json"),
			JSON.stringify({
				version: "1.0",
				items: items.map((item) => ({
					id: item.id,
					description: item.spec,
					stage: "code",
					spec: item.spec,
				})),
			}),
		);
	}

	it("should alert when spec A references ITEM-X that maps to spec B updated later", async () => {
		writeWorkflow([{ id: "ITEM-31", spec: "spec-b" }]);
		createSpec("spec-a", "2026-06-10", "- [x] **dependsOn**: ITEM-31");
		createSpec("spec-b", "2026-06-15", "- [x] **foo**: bar");

		const results = await crossSpecDepDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toContain("cross-spec-dep_spec-a_refs_spec-b");
		expect(results[0].certainty).toBe(0.6);
	});

	it("should be silent when spec A references spec B that was NOT updated later", async () => {
		writeWorkflow([{ id: "ITEM-31", spec: "spec-b" }]);
		createSpec("spec-a", "2026-06-15", "- [x] **dependsOn**: ITEM-31");
		createSpec("spec-b", "2026-06-10", "- [x] **foo**: bar");

		const results = await crossSpecDepDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect API path references between specs", async () => {
		createSpec("spec-a", "2026-06-10", "- [x] **consumes**: /api/diagnostics/scan");
		createSpec("spec-b", "2026-06-15", "- [x] **exposes**: /api/diagnostics/scan");

		const results = await crossSpecDepDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toContain("spec-a");
		expect(results[0].id).toContain("spec-b");
	});

	it("should be silent when no cross-spec references exist", async () => {
		createSpec("spec-a", "2026-06-10", "- [x] **independent**: true");
		createSpec("spec-b", "2026-06-15", "- [x] **alsoIndependent**: true");

		const results = await crossSpecDepDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});
});
