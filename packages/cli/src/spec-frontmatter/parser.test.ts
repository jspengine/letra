/**
 * Tests for spec-frontmatter parser.
 *
 * AC2: Parser lê frontmatter YAML, retorna objeto normalizado, warnings e errors.
 * AC3: Parser é único e compartilhado — este teste valida o comportamento esperado.
 */

import { describe, it, expect } from "vitest";
import {
  parseSpecFrontmatter,
  SPEC_FRONTMATTER_SCHEMA_VERSION_V1,
  SPEC_FRONTMATTER_REQUIRED_FIELDS_V1,
} from "./parser.js";

describe("parseSpecFrontmatter", () => {
  it("parseia frontmatter YAML válido com campos obrigatórios", () => {
    const text = [
      "---",
      "schemaVersion: \"1\"",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.item).toBe("ITEM-30");
    expect(result.data?.updated).toBe("2026-09-21");
    expect(result.data?.status).toBe("backlog");
    expect(result.data?.schemaVersion).toBe("1");
  });

  it("extrai campos opcionais adicionais", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: code",
      "spec: spec-frontmatter",
      "version: \"1.0.0\"",
      "outcome: |",
      "  Um parser YAML para frontmatter de specs.",
      "dependsOn: []",
      "acCount: 5",
      "acResolved: 0",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.spec).toBe("spec-frontmatter");
    expect(result.data?.version).toBe("1.0.0");
    expect(result.data?.dependsOn).toEqual([]);
    expect(result.data?.acCount).toBe(5);
    expect(result.data?.acResolved).toBe(0);
  });

  it("AC4: spec sem frontmatter emite warning legado e continua com heurística", () => {
    const text = ["# Spec: Test", "", "Conteúdo da spec..."].join("\n");

    const result = parseSpecFrontmatter(text);

    // Modo legado: aviso, não erro bloqueante
    expect(result.warnings.some((w) => w.message.includes("modo legado"))).toBe(
      true,
    );
    // Dados heurísticos podem estar vazios mas não nulos
    expect(result.data).not.toBeNull();
  });

  it("retorna erro para frontmatter não fechado", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.data).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("UNCLOSED_FRONTMATTER");
  });

  it("retorna erro para YAML inválido", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: [invalid",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.data).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("YAML_PARSE_ERROR");
  });

  it("retorna warnings para campos desconhecidos", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "customField: valor",
      "anotherField: 123",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.customField).toBe("valor");
    expect(result.data?.anotherField).toBe(123);
    // O parser não deve rejeitar campos desconhecidos, apenas incluí-los
    expect(result.warnings).toHaveLength(0);
  });

  it("retorna erro para campo obrigatório ausente", () => {
    const text = [
      "---",
      "schemaVersion: \"1\"",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.data).not.toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MISSING_REQUIRED_FIELD");
    expect(result.errors[0].message).toContain("item");
  });

  it("retorna erro para tipo inválido em campo obrigatório", () => {
    const text = [
      "---",
      "item: 123",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.data).not.toBeNull();
    expect(result.data?.item).toBe(123);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("INVALID_FIELD_TYPE");
  });

  it("normaliza schemaVersion de número para string", () => {
    const text = [
      "---",
      "schemaVersion: 1",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.schemaVersion).toBe("1");
  });

  it("normaliza acCount de string para número", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "acCount: \"5\"",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.acCount).toBe(5);
  });

  it("suporta block scalar (|) em outcome", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "outcome: |",
      "  Esta é uma descrição",
      "  de múltiplas linhas",
      "  do outcome.",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.outcome).toContain("descrição");
    expect(result.data?.outcome).toContain("múltiplas linhas");
  });

  it("suporta listas em dependsOn", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "dependsOn:",
      "  - spec-abc",
      "  - spec-xyz",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.dependsOn).toEqual(["spec-abc", "spec-xyz"]);
  });

  it("suporta valores null em supersededBy", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "supersededBy: null",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.supersededBy).toBeNull();
  });

  it("deteta frontmatter duplicado após o fechamento", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "---",
      "# Spec: Test",
      "",
      "---",
      "outro: valor",
      "---",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.data).not.toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.message.includes("duplicado"))).toBe(true);
  });

  it("ignora comentários YAML no frontmatter", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "# este comentário deve ser ignorado",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data?.item).toBe("ITEM-30");
  });

  it("mantem campos extras como estão (extensibilidade AC3)", () => {
    const text = [
      "---",
      "item: ITEM-30",
      "updated: \"2026-09-21\"",
      "status: backlog",
      "customMetadata: { key: \"value\" }",
      "anotherExtra: test",
      "---",
      "# Spec: Test",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
    // Campos extras devem ser preservados
    expect(result.data?.customMetadata).toBeDefined();
    expect(result.data?.anotherExtra).toBe("test");
  });

  it("AC4: spec sem frontmatter emite warning e continua com heurística transitória", () => {
    const text = [
      "# Spec: Test Legacy",
      "",
      "> Item: ITEM-30",
      "> Updated: 2026-09-21",
      "> Status: backlog",
      "",
      "Conteúdo da spec sem frontmatter...",
    ].join("\n");

    const result = parseSpecFrontmatter(text);

    // Não deve ser erro bloqueante
    expect(result.errors).toHaveLength(0);
    // Deve emitir warning de modo legado
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) =>
        w.message.includes("modo legado"),
      ),
    ).toBe(true);
    // Deve continuar com heurística transitória
    expect(result.data).not.toBeNull();
    expect(result.data?.item).toBe("ITEM-30");
    expect(result.data?.updated).toBe("2026-09-21");
    expect(result.data?.status).toBe("backlog");
    expect(result.data?.spec).toBe("legacy");
  });

  it("AC4: spec sem frontmatter e sem headers legados retorna dados vazios com warnings", () => {
    const text = ["# Spec: Test Bare", "", "Conteúdo sem metadados..."].join(
      "\n",
    );

    const result = parseSpecFrontmatter(text);

    // Warning de legado obrigatório
    expect(result.warnings.some((w) => w.message.includes("modo legado"))).toBe(
      true,
    );
    // Heurística tentou mas não encontrou campos
    expect(result.data).not.toBeNull();
    expect(result.data?.item).toBeUndefined();
    expect(result.data?.updated).toBeUndefined();
    expect(result.data?.status).toBeUndefined();
  });
});
