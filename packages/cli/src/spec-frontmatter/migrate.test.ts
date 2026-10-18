/**
 * Tests for spec-frontmatter migration.
 *
 * AC4: Specs sem frontmatter são detectados como legado.
 * AC5: Migrador idempotente transforma specs legados em frontmatter v1.
 */

import { describe, it, expect } from "vitest";
import {
  hasFrontmatter,
  extractLegacyMetadata,
  generateFrontmatterYaml,
  migrateSpecToFrontmatterV1,
  migrateAllSpecsToFrontmatterV1,
  type MigrationReportEntry,
} from "./migrate.js";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "letra-migrate-test-"));
}

function setupLegacySpec(workspaceRoot: string, specId: string, content: string): void {
  mkdirSync(join(workspaceRoot, "specs", specId), { recursive: true });
  writeFileSync(join(workspaceRoot, "specs", specId, "spec.md"), content);
}

describe("hasFrontmatter", () => {
  it("retorna true para texto com frontmatter", () => {
    expect(hasFrontmatter(["---", "item: TEST", "---", "# Spec"].join("\n"))).toBe(true);
  });

  it("retorna false para texto sem frontmatter", () => {
    expect(hasFrontmatter("# Spec sem frontmatter")).toBe(false);
  });

  it("retorna false para texto vazio", () => {
    expect(hasFrontmatter("")).toBe(false);
  });
});

describe("extractLegacyMetadata", () => {
  it("extrai item, updated e status de header legado", () => {
    const text = [
      "# Spec: Test",
      "> Item: ITEM-42",
      "> Updated: 2026-06-23",
      "> Status: design",
      "",
      "Conteúdo...",
    ].join("\n");

    const result = extractLegacyMetadata(text, "test-spec");

    expect(result.data.item).toBe("ITEM-42");
    expect(result.data.updated).toBe("2026-06-23");
    expect(result.data.status).toBe("design");
    expect(result.data.spec).toBe("test-spec");
    expect(result.inferred).toContain("item (do header > Item:)");
    expect(result.inferred).toContain("updated (do header > Updated:)");
    expect(result.inferred).toContain("status (do header > Status:)");
    expect(result.missing).toHaveLength(0);
  });

  it("converte formato de data dd/mm/yyyy para ISO", () => {
    const text = [
      "# Spec: Test",
      "> Item: ITEM-42",
      "> Updated: 23/06/2026",
      "> Status: code",
    ].join("\n");

    const result = extractLegacyMetadata(text, "test-spec");

    expect(result.data.updated).toBe("2026-06-23");
  });

  it("reporta campos ausentes quando headers não existem", () => {
    const text = [
      "# Spec: Test",
      "",
      "Conteúdo...",
    ].join("\n");

    const result = extractLegacyMetadata(text, "test-spec");

    expect(result.data.item).toBeUndefined();
    expect(result.missing).toContain("item");
    expect(result.missing).toContain("updated");
    expect(result.missing).toContain("status");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("generateFrontmatterYaml", () => {
  it("gera YAML válido com campos obrigatórios", () => {
    const yaml = generateFrontmatterYaml({
      item: "ITEM-30",
      updated: "2026-09-21",
      status: "backlog",
    });

    expect(yaml).toContain("---");
    expect(yaml).toContain("item: ITEM-30");
    expect(yaml).toContain("updated: \"2026-09-21\"");
    expect(yaml).toContain("status: backlog");
  });

  it("gera schemaVersion padrão quando não informado", () => {
    const yaml = generateFrontmatterYaml({
      item: "ITEM-30",
      updated: "2026-09-21",
      status: "backlog",
    });

    expect(yaml).toContain('schemaVersion: "1"');
  });

  it("gera campos opcionais quando informados", () => {
    const yaml = generateFrontmatterYaml({
      item: "ITEM-30",
      updated: "2026-09-21",
      status: "backlog",
      spec: "spec-frontmatter",
      version: "1.0.0",
      outcome: "Um parser YAML para specs.",
      dependsOn: ["spec-abc"],
      acCount: 5,
      acResolved: 0,
    });

    expect(yaml).toContain("spec: spec-frontmatter");
    expect(yaml).toContain("version: \"1.0.0\"");
    expect(yaml).toContain("acCount: 5");
    expect(yaml).toContain("acResolved: 0");
  });

  it("gera block scalar para outcome multi-linha", () => {
    const yaml = generateFrontmatterYaml({
      item: "ITEM-30",
      updated: "2026-09-21",
      status: "backlog",
      outcome: "Linha 1\nLinha 2\nLinha 3",
    });

    expect(yaml).toContain("outcome: |");
    expect(yaml).toContain("  Linha 1");
    expect(yaml).toContain("  Linha 2");
    expect(yaml).toContain("  Linha 3");
  });
});

describe("migrateSpecToFrontmatterV1", () => {
  it("migra spec legado para frontmatter v1", () => {
    const ws = createTempWorkspace();
    setupLegacySpec(ws, "test-spec", [
      "# Spec: Test",
      "> Item: ITEM-42",
      "> Updated: 2026-06-23",
      "> Status: design",
      "",
      "Conteúdo da spec...",
    ].join("\n"));

    const entry = migrateSpecToFrontmatterV1(ws, "test-spec");

    expect(entry?.migrated).toBe(true);
    expect(entry?.frontmatterWritten).toBe(true);
    expect(entry?.errors).toHaveLength(0);

    // Verifica que o arquivo foi atualizado
    const newContent = readFileSync(join(ws, "specs", "test-spec", "spec.md"), "utf-8");
    expect(newContent).toContain("---");
    expect(newContent).toContain("item: ITEM-42");
    expect(newContent).toContain("status: design");
    expect(newContent).toContain("Conteúdo da spec...");

    // Headers antigos foram removidos
    expect(newContent).not.toMatch(/^>\s*Item:/m);

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("é idempotente: não migra spec que já tem frontmatter", () => {
    const ws = createTempWorkspace();
    setupLegacySpec(ws, "test-spec", [
      "---",
      "item: ITEM-42",
      "updated: \"2026-06-23\"",
      "status: design",
      "---",
      "# Spec: Test",
    ].join("\n"));

    const entry = migrateSpecToFrontmatterV1(ws, "test-spec");

    expect(entry?.migrated).toBe(false);
    expect(entry?.errors).toContain("já possui frontmatter YAML — ignorado (idempotente)");

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("reporta erro para spec inexistente", () => {
    const ws = createTempWorkspace();

    const entry = migrateSpecToFrontmatterV1(ws, "nonexistent");

    expect(entry?.migrated).toBe(false);
    expect(entry?.errors.length).toBeGreaterThan(0);

    writeFileSync(join(ws, ".cleanup"), "");
  });
});

describe("migrateAllSpecsToFrontmatterV1", () => {
  it("migra múltiplas specs legadas", () => {
    const ws = createTempWorkspace();
    setupLegacySpec(ws, "spec-1", [
      "# Spec 1",
      "> Item: ITEM-01",
      "> Updated: 2026-01-01",
      "> Status: done",
    ].join("\n"));
    setupLegacySpec(ws, "spec-2", [
      "# Spec 2",
      "> Item: ITEM-02",
      "> Updated: 2026-02-02",
      "> Status: backlog",
    ].join("\n"));
    setupLegacySpec(ws, "spec-3", [
      "---",
      "item: ITEM-03",
      "updated: \"2026-03-03\"",
      "status: code",
      "---",
      "# Spec 3 já tem frontmatter",
    ].join("\n"));

    const report = migrateAllSpecsToFrontmatterV1(ws);

    expect(report.totalSpecs).toBe(3);
    expect(report.migratedSpecs).toBe(2); // apenas as 2 legadas

    for (const entry of report.entries) {
      if (entry.specId === "spec-3") {
        expect(entry.migrated).toBe(false);
      } else {
        expect(entry.migrated).toBe(true);
      }
    }

    // Verifica que os arquivos foram migrados
    const spec1Content = readFileSync(join(ws, "specs", "spec-1", "spec.md"), "utf-8");
    expect(spec1Content).toContain("---");
    expect(spec1Content).not.toMatch(/^>\s*Item:/m);

    const spec3Content = readFileSync(join(ws, "specs", "spec-3", "spec.md"), "utf-8");
    expect(spec3Content).toContain("---");
    // spec-3 não deve ser alterado (já tem frontmatter)
    expect(spec3Content).toContain("item: ITEM-03");

    writeFileSync(join(ws, ".cleanup"), "");
  });

  it("retorna report vazio para workspace sem specs", () => {
    const ws = createTempWorkspace();

    const report = migrateAllSpecsToFrontmatterV1(ws);

    expect(report.totalSpecs).toBe(0);
    expect(report.migratedSpecs).toBe(0);
    expect(report.entries).toHaveLength(0);

    writeFileSync(join(ws, ".cleanup"), "");
  });
});
