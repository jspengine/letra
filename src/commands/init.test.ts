import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { init } from "./init.js";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("init command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `letra-init-test-${Date.now()}`);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should create .letra directory with required files", async () => {
    await init(tmpDir);

    expect(existsSync(join(tmpDir, ".letra"))).toBe(true);
    expect(existsSync(join(tmpDir, ".letra", "context.md"))).toBe(true);
    expect(existsSync(join(tmpDir, ".letra", "constitution.md"))).toBe(true);
    expect(existsSync(join(tmpDir, ".letra", "glossary.md"))).toBe(true);
    expect(existsSync(join(tmpDir, ".letra", "specs", "_template.md"))).toBe(true);
  });

  it("should generate Cursor adapter", async () => {
    await init(tmpDir);
    expect(existsSync(join(tmpDir, ".cursorrules"))).toBe(true);
    
    const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
    expect(content).toContain("Letra Context — Cursor Adapter");
  });

  it("should generate VSCode adapter files", async () => {
    await init(tmpDir);
    expect(existsSync(join(tmpDir, ".github", "copilot-instructions.md"))).toBe(true);
    expect(existsSync(join(tmpDir, ".vscode", "settings.json"))).toBe(true);
  });
});
