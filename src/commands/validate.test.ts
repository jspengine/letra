import {
	existsSync,
	mkdirSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "./init.js";
import { checkSpecContent } from "./validate.js";

describe("validate - checkSpecContent", () => {
	let tmpDir: string;
	let specDir: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `letra-validate-test-${Date.now()}`);
		await init(tmpDir);
		specDir = join(tmpDir, ".letra", "specs", "test-spec");
		mkdirSync(specDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should return FAIL for missing spec.md", () => {
		const result = checkSpecContent(specDir, "Conteúdo Mínimo", "test");
		expect(result).toEqual({ status: "FAIL", note: "(spec.md not found)" });
	});

	it("should return PASS when Outcome has 50+ chars", () => {
		const specContent = `# Spec: Test

## Outcome
This is a very detailed outcome description that definitely has more than fifty characters to pass the minimum content check.

## Constraints
Test constraint.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Conteúdo Mínimo**: Spec has sufficient Outcome content.

## Context
Testing.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Conteúdo Mínimo", "test");
		expect(result?.status).toBe("PASS");
		expect(result?.note).toContain("chars");
	});

	it("should return FAIL when Outcome has less than 50 chars", () => {
		const specContent = `# Spec: Test

## Outcome
Too short.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Conteúdo Mínimo**: Test.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Conteúdo Mínimo", "test");
		expect(result?.status).toBe("FAIL");
		expect(result?.note).toContain("only");
	});

	it("should detect colloquialisms in spec", () => {
		const specContent = `# Spec: Test

## Outcome
This feature is awesome, tipo very cool and blz.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Detecção de Tom**: Formal tone.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Detecção de Tom", "test");
		expect(result?.status).toBe("FAIL");
		expect(result?.note).toContain("colloquialisms");
	});

	it("should pass formal tone check when no colloquialisms", () => {
		const specContent = `# Spec: Test

## Outcome
This feature provides a formal specification for validation purposes.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Detecção de Tom**: Formal tone.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Detecção de Tom", "test");
		expect(result?.status).toBe("PASS");
	});

	it("should check terminology consistency against glossary", () => {
		// Create glossary with terms
		const glossaryContent = `## Termos

**Letra**: Framework de SDD.
**Spec**: Documento de especificação.
`;
		writeFileSync(join(tmpDir, ".letra", "glossary.md"), glossaryContent);

		const specContent = `# Spec: Test

## Outcome
Usando o Letra framework para criar uma spec.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Consistência de Terminologia**: Terms used.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(
			specDir,
			"Consistência de Terminologia",
			"test",
		);
		expect(result?.status).toBe("PASS");
	});

	it("should fail terminology check when terms are missing", () => {
		const glossaryContent = `## Termos

**Letra**: Framework de SDD.
**Spec**: Documento de especificação.
**Drift**: Desvio semântico.
`;
		writeFileSync(join(tmpDir, ".letra", "glossary.md"), glossaryContent);

		const specContent = `# Spec: Test

## Outcome
Usando o Letra framework.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Consistência de Terminologia**: Terms used.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(
			specDir,
			"Consistência de Terminologia",
			"test",
		);
		expect(result?.status).toBe("FAIL");
		expect(result?.note).toContain("missing");
	});

	it("should detect stale specs (drift temporal)", () => {
		const specContent = `# Spec: Test

## Outcome
Old spec content.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Drift Temporal**: Spec is fresh.

## Context
Test.
`;
		const specFile = join(specDir, "spec.md");
		writeFileSync(specFile, specContent);

		// Make file appear old (31 days ago)
		const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000;
		utimesSync(specFile, oldTime / 1000, oldTime / 1000);

		const result = checkSpecContent(specDir, "Drift Temporal", "test");
		expect(result?.status).toBe("FAIL");
		expect(result?.note).toContain("stale");
	});

	it("should pass drift check for fresh specs", () => {
		const specContent = `# Spec: Test

## Outcome
Fresh spec content.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Drift Temporal**: Spec is fresh.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Drift Temporal", "test");
		expect(result?.status).toBe("PASS");
	});

	it("should return null for unknown label", () => {
		const specContent = `# Spec: Test

## Outcome
Some content.

## Constraints
None.

## Exclusions
None.

## Acceptance Criteria
- [ ] **Unknown**: Test.

## Context
Test.
`;
		writeFileSync(join(specDir, "spec.md"), specContent);

		const result = checkSpecContent(specDir, "Unknown Label", "test");
		expect(result).toBeNull();
	});
});
