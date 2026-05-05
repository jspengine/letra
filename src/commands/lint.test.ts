import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { lint } from "./lint.js";
import { init } from "./init.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("lint command", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `letra-lint-test-${Date.now()}`);
    await init(tmpDir);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should pass for valid spec with all required sections", async () => {
    const specName = "valid-spec";
    const specDir = join(tmpDir, ".letra", "specs", specName);
    mkdirSync(specDir, { recursive: true });

    const validSpec = `# Spec: ${specName}

## Outcome
Valid outcome description with sufficient length to pass the minimum check.

## Constraints
Technical and business constraints that must not be violated.

## Exclusions
What is explicitly out of scope.

## Acceptance Criteria
- [ ] **Critério 1**: Binary description (pass/fail).

## Context
Why we are building this. Trade-offs considered.
`;

    writeFileSync(join(specDir, "spec.md"), validSpec);
    writeFileSync(join(specDir, "acceptance.md"), "# Acceptance Criteria\n- [ ] **Critério 1**: Description.");

    const originalExit = process.exit;
    let exitCode = 0;
    process.exit = (code?: number) => {
      exitCode = code || 0;
      throw new Error("exit");
    };

    try {
      await lint(tmpDir);
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(0);
    process.exit = originalExit;
  });

  it("should fail for spec missing required sections", async () => {
    const specName = "invalid-spec";
    const specDir = join(tmpDir, ".letra", "specs", specName);
    mkdirSync(specDir, { recursive: true });

    const invalidSpec = `# Spec: ${specName}\n\nNo required sections here.`;
    writeFileSync(join(specDir, "spec.md"), invalidSpec);

    const originalExit = process.exit;
    let exitCode = 0;
    process.exit = (code?: number) => {
      exitCode = code || 0;
      throw new Error("exit");
    };

    try {
      await lint(tmpDir);
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
    process.exit = originalExit;
  });
});
