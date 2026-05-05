import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { specNew } from "./spec.js";
import { init } from "./init.js";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("spec command", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `letra-spec-test-${Date.now()}`);
    originalCwd = process.cwd();
    await init(tmpDir);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should create spec directory with required files", async () => {
    const specName = "test-spec";
    await specNew(specName);

    const specDir = join(tmpDir, ".letra", "specs", specName);
    expect(existsSync(specDir)).toBe(true);
    expect(existsSync(join(specDir, "spec.md"))).toBe(true);
    expect(existsSync(join(specDir, "acceptance.md"))).toBe(true);

    const specContent = readFileSync(join(specDir, "spec.md"), "utf-8");
    expect(specContent).toContain(`# Spec: ${specName}`);
    expect(specContent).toContain("## Outcome");
  });

  it("should not overwrite existing spec", async () => {
    const specName = "existing-spec";
    await specNew(specName);
    
    // Second call should not throw or overwrite
    await expect(specNew(specName)).resolves.not.toThrow();
  });
});
