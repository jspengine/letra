import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countACs } from "./ac-counter.js";

describe("ac-counter - countACs", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-ac-counter-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should count ACs from spec.md only if acceptance.md does not exist", () => {
		writeFileSync(
			join(tmpDir, "spec.md"),
			`# Test Spec
## Outcome
Blabla

## Acceptance Criteria
- [ ] **AC 1**: Test description
- [x] **AC 2**: Done description
- [ ] **AC 3**: Open description

## Context
Context info
`,
		);

		const result = countACs(tmpDir);
		expect(result.pending).toBe(2);
		expect(result.total).toBe(3);
		expect(result.specCount).toBe(3);
		expect(result.acceptanceCount).toBe(0);
		expect(result.drift).toBe(false);
	});

	it("should count ACs from acceptance.md and return drift false if counts match", () => {
		writeFileSync(
			join(tmpDir, "spec.md"),
			`# Test Spec
## Acceptance Criteria
- [ ] **AC 1**: Desc
- [x] **AC 2**: Desc
`,
		);

		writeFileSync(
			join(tmpDir, "acceptance.md"),
			`# Acceptance Criteria
- [ ] **AC 1**: Desc
- [x] **AC 2**: Desc
`,
		);

		const result = countACs(tmpDir);
		expect(result.pending).toBe(1);
		expect(result.total).toBe(2);
		expect(result.specCount).toBe(2);
		expect(result.acceptanceCount).toBe(2);
		expect(result.drift).toBe(false);
	});

	it("should return drift true if acceptance.md and spec.md totals differ", () => {
		writeFileSync(
			join(tmpDir, "spec.md"),
			`# Test Spec
## Acceptance Criteria
- [ ] **AC 1**: Desc
- [x] **AC 2**: Desc
`,
		);

		writeFileSync(
			join(tmpDir, "acceptance.md"),
			`# Acceptance Criteria
- [ ] **AC 1**: Desc
- [x] **AC 2**: Desc
- [ ] **AC 3**: Extra
`,
		);

		const result = countACs(tmpDir);
		expect(result.pending).toBe(2);
		expect(result.total).toBe(3);
		expect(result.specCount).toBe(2);
		expect(result.acceptanceCount).toBe(3);
		expect(result.drift).toBe(true);
	});

	it("should handle empty or missing sections gracefully", () => {
		writeFileSync(join(tmpDir, "spec.md"), "# Test Spec\n");

		const result = countACs(tmpDir);
		expect(result.pending).toBe(0);
		expect(result.total).toBe(0);
		expect(result.specCount).toBe(0);
		expect(result.acceptanceCount).toBe(0);
		expect(result.drift).toBe(false);
	});
});
