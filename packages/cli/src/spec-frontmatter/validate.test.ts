/**
 * Tests for spec-frontmatter validation.
 */

import { describe, it, expect } from "vitest";
import { validateSpecFrontmatter, validateAllSpecsFrontmatter } from "./validate.js";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createTempWorkspace(): string {
  const tmp = mkdtempSync(join(tmpdir(), "letra-test-"));
  return tmp;
}

function setupSpec(workspaceRoot: string, specId: string, frontmatter: string, acceptance?: string): void {
  const specDir = join(workspaceRoot, "specs", specId);
  writeFileSync(join(specDir, "spec.md"), frontmatter);
  if (acceptance) {
    writeFileSync(join(specDir, "acceptance.md"), acceptance);
  }
}

describe("validateSpecFrontmatter", () => {
  it("valida frontmatter válido sem issues", () => {
    const ws = createTempWorkspace();
    setupSpec(ws, "test-spec", [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
    ].join("\n"));

    const result = validateSpecFrontmatter(ws, "test-spec");

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.frontmatter?.item).toBe("ITEM-30");

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("detecta arquivo de spec ausente", () => {
    const ws = createTempWorkspace();

    const result = validateSpecFrontmatter(ws, "nonexistent-spec");

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "SPEC_FILE_MISSING")).toBe(true);

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("detecta campo obrigatório ausente", () => {
    const ws = createTempWorkspace();
    setupSpec(ws, "test-spec", [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "---",
      "# Spec: Test",
    ].join("\n"));

    const result = validateSpecFrontmatter(ws, "test-spec");

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "REQUIRED_FIELD_MISSING" && i.field === "status")).toBe(true);

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("detecta drift entre frontmatter status=done e acceptance com ACs pendentes", () => {
    const ws = createTempWorkspace();
    setupSpec(
      ws,
      "test-spec",
      [
        "---",
        "item: ITEM-30",
        "updated: \"2026-09-21\"",
        "status: done",
        "---",
        "# Spec: Test",
      ].join("\n"),
      [
        "# Acceptance",
        "- [ ] **AC1**: fazer algo",
        "- [x] **AC2**: fazer outra coisa",
      ].join("\n"),
    );

    const result = validateSpecFrontmatter(ws, "test-spec");

    expect(result.valid).toBe(true); // drift é warning, não error
    expect(result.issues.some((i) => i.code === "DRIFT_FRONTMATTER_ACCEPTANCE")).toBe(true);

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("detecta drift entre frontmatter acResolved e acceptance real", () => {
    const ws = createTempWorkspace();
    setupSpec(
      ws,
      "test-spec",
      [
        "---",
        "item: ITEM-30",
        "updated: \"2026-09-21\"",
        "status: backlog",
        "acResolved: 5",
        "acCount: 3",
        "---",
        "# Spec: Test",
      ].join("\n"),
      [
        "# Acceptance",
        "- [x] **AC1**: fazer algo",
        "- [ ] **AC2**: fazer outra coisa",
      ].join("\n"),
    );

    const result = validateSpecFrontmatter(ws, "test-spec");

    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "DRIFT_FRONTMATTER_ACCEPTANCE")).toBe(true);

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("reporta spec sem frontmatter como legado (warning)", () => {
    const ws = createTempWorkspace();
    writeFileSync(join(ws, "specs", "legacy-spec", "spec.md"), [
      "# Spec: Legacy",
      "",
      "Sem frontmatter YAML.",
    ].join("\n"));

    const result = validateSpecFrontmatter(ws, "legacy-spec");

    expect(result.frontmatter).toBeNull();
    expect(result.issues.some((i) => i.code === "LEGACY_NO_FRONTMATTER")).toBe(true);
    expect(result.valid).toBe(true); // legado é warning, não error

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("valida frontmatter com status customizado (warning, não error)", () => {
    const ws = createTempWorkspace();
    setupSpec(ws, "test-spec", [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: rascunho",
      "---",
      "# Spec: Test",
    ].join("\n"));

    const result = validateSpecFrontmatter(ws, "test-spec");

    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "STATUS_UNKNOWN")).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);

    writeFileSync(join(ws, ".cleanup"), "");
  });
});

describe("validateAllSpecsFrontmatter", () => {
  it("valida múltiplas specs e reporta resumos", () => {
    const ws = createTempWorkspace();
    setupSpec(ws, "spec-a", [
      "---",
      "item: ITEM-01",
      "updated: \"2026-09-21\"",
      "status: done",
      "---",
      "# Spec A",
    ].join("\n"));
    setupSpec(ws, "spec-b", [
      "---",
      "item: ITEM-02",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec B",
    ].join("\n"));
    setupSpec(ws, "spec-c", [
      "# Spec C — sem frontmatter",
    ].join("\n"));

    const { results, hasErrors } = validateAllSpecsFrontmatter(ws);

    expect(results.size).toBe(3);
    expect(hasErrors).toBe(false); // apenas warnings, não errors

    const specA = results.get("spec-a");
    expect(specA?.valid).toBe(true);
    expect(specA?.frontmatter?.item).toBe("ITEM-01");

    const specC = results.get("spec-c");
    expect(specC?.frontmatter).toBeNull();

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("retorna hasErrors=true quando há spec com campo obrigatório faltando", () => {
    const ws = createTempWorkspace();
    setupSpec(ws, "spec-bad", [
      "---",
      "item: ITEM-01",
      "updated: \"2026-09-21\"",
      "---",
      "# Spec Bad",
    ].join("\n"));

    const { results, hasErrors } = validateAllSpecsFrontmatter(ws);

    expect(hasErrors).toBe(true);
    expect(results.get("spec-bad")?.valid).toBe(false);

    writeFileSync(join(ws, ".cleanup"), "");
  });
});
