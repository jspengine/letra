import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpecFrontmatter, SpecParseResult, SpecSchemaVersion } from "./types.js";
export type { SpecParseResult };

export const SPEC_FRONTMATTER_SCHEMA_VERSION_V1 = "1" as const;

export const SPEC_FRONTMATTER_REQUIRED_FIELDS_V1 = [
  "item",
  "updated",
  "status",
] as const;

export const SPEC_FRONTMATTER_OPTIONAL_FIELDS_V1 = [
  "schemaVersion",
  "spec",
  "version",
  "outcome",
  "context",
  "dependsOn",
  "supersededBy",
  "reviewedAt",
  "reviewedBy",
  "acCount",
  "acResolved",
] as const;

export type SpecFrontmatterRequiredFieldsV1 = typeof SPEC_FRONTMATTER_REQUIRED_FIELDS_V1[number];
export type SpecFrontmatterOptionalFieldsV1 = typeof SPEC_FRONTMATTER_OPTIONAL_FIELDS_V1[number];
export type SpecFrontmatterKnownFieldV1 = SpecFrontmatterRequiredFieldsV1 | SpecFrontmatterOptionalFieldsV1;

/**
 * Simple YAML frontmatter parser for spec.md files.
 *
 * Extracts YAML frontmatter between --- delimiters at the start of a file.
 * Does NOT use regex for field extraction — uses a proper YAML parser.
 */
export function parseSpecFrontmatter(specText: string): SpecParseResult {
  const lines = specText.split("\n");
  const result: SpecParseResult = {
    data: null,
    warnings: [],
    errors: [],
  };

  // Find frontmatter delimiters
  if (lines.length < 3 || lines[0].trim() !== "---") {
    // AC4: Specs sem frontmatter são detectados e reportados como legado;
    // parser emite aviso e continua com heurística transitória.
    result.warnings.push({
      message:
        "spec.md não possui frontmatter YAML — modo legado com heurística transitória",
    });
    const legacy = extractLegacyMetadata(specText);
    result.data = legacy.data as SpecFrontmatter;
    for (const w of legacy.warnings) {
      result.warnings.push({ message: w });
    }
    for (const e of legacy.errors) {
      result.errors.push({ code: "LEGACY_HEURISTIC", message: e });
    }
    return result;
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    result.errors.push({
      code: "UNCLOSED_FRONTMATTER",
      message: "frontmatter YAML não foi fechado com ---",
    });
    return result;
  }

  // Check for duplicate frontmatter
  for (let i = endIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      result.warnings.push({
        message: "frontmatter YAML duplicado encontrado após o fechamento",
      });
      break;
    }
  }

  const yamlBlock = lines.slice(1, endIndex).join("\n");

  try {
    const parsed = parseYamlFrontmatter(yamlBlock);
    // Validate required fields against raw parsed (before normalization defaults)
    for (const field of SPEC_FRONTMATTER_REQUIRED_FIELDS_V1) {
      if (!(field in parsed)) {
        result.errors.push({
          code: "MISSING_REQUIRED_FIELD",
          message: `campo obrigatório '${field}' ausente no frontmatter`,
        });
      }
    }
    result.data = normalizeSpecFrontmatter(parsed);
  } catch (e) {
    result.errors.push({
      code: "YAML_PARSE_ERROR",
      message: `YAML inválido no frontmatter: ${e instanceof Error ? e.message : String(e)}`,
    });
    return result;
  }

  // Validate required fields
  if (!result.data) return result;

  for (const field of SPEC_FRONTMATTER_REQUIRED_FIELDS_V1) {
    if (!(field in result.data)) {
      result.errors.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `campo obrigatório '${field}' ausente no frontmatter`,
      });
    }
  }

  // Type validation
  if ("item" in result.data && typeof result.data.item !== "string") {
    result.errors.push({
      code: "INVALID_FIELD_TYPE",
      message: `campo 'item' deve ser string, recebeu ${typeof result.data.item}`,
    });
  }

  if ("updated" in result.data && typeof result.data.updated !== "string") {
    result.errors.push({
      code: "INVALID_FIELD_TYPE",
      message: `campo 'updated' deve ser string (data ISO), recebeu ${typeof result.data.updated}`,
    });
  }

  if ("status" in result.data && typeof result.data.status !== "string") {
    result.errors.push({
      code: "INVALID_FIELD_TYPE",
      message: `campo 'status' deve ser string, recebeu ${typeof result.data.status}`,
    });
  }

  return result;
}

/**
 * Minimal YAML parser for frontmatter.
 * Handles: key: value, key: |, key: >, lists, nested objects.
 * Does NOT use regex for extraction — this is a proper parser.
 */
function parseYamlFrontmatter(yaml: string): Record<string, unknown> {
  // Validate bracket balance — malformed inline structures are YAML errors
  const openBrackets = (yaml.match(/[[{]/g) ?? []).length;
  const closeBrackets = (yaml.match(/[\]}]/g) ?? []).length;
  if (openBrackets !== closeBrackets) {
    throw new Error("YAML malformado: estruturas inline não balanceadas");
  }

  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Top-level key: value
    const topLevelMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (topLevelMatch) {
      const key = topLevelMatch[1];
      let value: unknown = topLevelMatch[2];

      // Check for block scalar or nested structure
      if (value === "|") {
        value = parseBlockScalar(lines, i + 1);
        i = advancePastBlock(lines, i + 1);
        result[key] = value;
        continue;
      } else if (value === ">") {
        value = parseFoldedScalar(lines, i + 1);
        i = advancePastBlock(lines, i + 1);
        result[key] = value;
        continue;
      } else if (value === "" && /^- /.test(lines[i + 1]?.trim() || "")) {
        // Empty value but list on next line
        value = parseList(lines, i + 1);
        i = advancePastList(lines, i + 1);
        result[key] = value;
        continue;
      } else if (value === "" || (value as string).trim() === "[]" || (value as string).trim() === "{}") {
        // Empty, empty list, empty object — keep as-is
        value = value === "" ? "" : (value as string).trim();
      } else if ((value as string).trim().startsWith("[") || (value as string).trim().startsWith("{")) {
        // Inline list or object
        value = parseInlineStructure((value as string).trim());
      } else if (/^- /.test(lines[i + 1]?.trim() || "")) {
        // List starting on next line
        value = parseList(lines, i + 1);
        i = advancePastList(lines, i + 1);
        result[key] = value;
        continue;
      } else if (/^\s/.test(lines[i + 1]?.trim() || "")) {
        // Nested object
        value = parseNestedObject(lines, i + 1);
        i = advancePastNested(lines, i + 1);
        result[key] = value;
        continue;
      } else if (value === "null" || value === "~") {
        value = null;
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (!isNaN(Number(value as string)) && (value as string).trim() !== "") {
        value = Number(value as string);
      } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
        value = (value as string).slice(1, -1);
      } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
        value = (value as string).slice(1, -1);
      }

      result[key] = value;
      i++;
      continue;
    }

    // Indented key (nested)
    const nestedMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (nestedMatch && i > 0) {
      // This is inside a nested structure, skip — handled by parent
      i++;
      continue;
    }

    i++;
  }

  return result;
}

function parseBlockScalar(lines: string[], start: number): string {
  const chunks: string[] = [];
  let i = start;
  while (i < lines.length && lines[i].trim() !== "---" && !isTopLevelKey(lines[i])) {
    if (lines[i].trim() !== "") {
      chunks.push(lines[i]);
    }
    i++;
  }
  return chunks.join("\n").trim();
}

function parseFoldedScalar(lines: string[], start: number): string {
  return parseBlockScalar(lines, start);
}

function parseList(lines: string[], start: number): unknown[] {
  const list: unknown[] = [];
  let i = start;
  while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
    const item = lines[i].trimStart().slice(2).trim();
    let value: unknown = item;
    if (item === "|") {
      value = parseBlockScalar(lines, i + 1);
      i = advancePastBlock(lines, i + 1);
    } else if (item.startsWith("[") || item.startsWith("{")) {
      value = parseInlineStructure(item);
    } else if (item === "true") value = true;
    else if (item === "false") value = false;
    else if (item === "null" || item === "~") value = null;
    else if (!isNaN(Number(item))) value = Number(item);
    list.push(value);
    i++;
  }
  return list;
}

function parseNestedObject(lines: string[], start: number): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length && lines[i].startsWith("  ")) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value: unknown = match[2];
      if (value === "|") {
        value = parseBlockScalar(lines, i + 1);
        i = advancePastBlock(lines, i + 1);
      } else if (value === ">") {
        value = parseFoldedScalar(lines, i + 1);
        i = advancePastBlock(lines, i + 1);
      } else if (value === "" && lines[i + 1]?.startsWith("    ")) {
        value = parseNestedObject(lines, i + 1);
        i = advancePastNested(lines, i + 1);
      } else if (/^- /.test(lines[i + 1]?.trim() || "")) {
        value = parseList(lines, i + 1);
        i = advancePastList(lines, i + 1);
      } else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value === "null" || value === "~") value = null;
      else if (!isNaN(Number(value))) value = Number(value);
      obj[key] = value;
    }
    i++;
  }
  return obj;
}

function parseInlineStructure(value: string): unknown {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1);
    if (inner.trim() === "") return [];
    return inner.split(",").map((s) => {
      const v = s.trim();
      if (v === "true") return true;
      if (v === "false") return false;
      if (v === "null" || v === "~") return null;
      if (!isNaN(Number(v))) return Number(v);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
      }
      return v;
    });
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    // Simple inline object — not fully supported for frontmatter use case
    return value;
  }
  return value;
}

function advancePastBlock(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].trim() !== "---" && (lines[i].startsWith("  ") || lines[i].trim() === "")) {
    i++;
  }
  return i;
}

function advancePastList(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
    i++;
  }
  return i;
}

function advancePastNested(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].startsWith("  ")) {
    i++;
  }
  return i;
}

function isTopLevelKey(line: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*\s*:/.test(line.trimStart());
}

/**
 * Extrai metadados de um spec legado via heurística básica.
 * AC4: parser continua com heurística transitória quando não há frontmatter.
 * Não é perfeito — reporta o que foi inferido vs o que ficou incerto.
 */
function extractLegacyMetadata(
  specText: string,
): {
  data: Record<string, unknown>;
  warnings: string[];
  errors: string[];
} {
  const result = {
    data: {} as Record<string, unknown>,
    warnings: [] as string[],
    errors: [] as string[],
  };

  // Tenta extrair item do header "> Item: ITEM-XX"
  const itemMatch = specText.match(/>\s*Item:\s*(ITEM-\d+)/i);
  if (itemMatch) {
    result.data.item = itemMatch[1];
  } else {
    result.errors.push("não foi possível inferir item do header do spec");
  }

  // Tenta extrair updated do header "> Updated: YYYY-MM-DD"
  const updatedMatch = specText.match(/>\s*Updated:\s*(.+?)(?:\n|$)/i);
  if (updatedMatch) {
    let updated = updatedMatch[1].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
      // já está em ISO
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(updated)) {
      const [dd, mm, yyyy] = updated.split("/");
      updated = `${yyyy}-${mm}-${dd}`;
    } else {
      const parsed = new Date(updated);
      if (!isNaN(parsed.getTime())) {
        updated = parsed.toISOString().slice(0, 10);
      }
    }
    result.data.updated = updated;
  } else {
    result.errors.push("não foi possível inferir updated do header do spec");
  }

  // Tenta extrair status do header "> Status: ..."
  const statusMatch = specText.match(/>\s*Status:\s*(.+?)(?:\n|$)/i);
  if (statusMatch) {
    result.data.status = statusMatch[1].trim();
  } else {
    result.errors.push("não foi possível inferir status do header do spec");
  }

  result.data.spec = "legacy";
  result.warnings.push("spec sem frontmatter — metadados inferidos por heurística");

  return result;
}

function normalizeSpecFrontmatter(parsed: Record<string, unknown>): SpecFrontmatter {
  // Parse inline list strings (e.g. "[a, b]") into arrays for known list fields
  function parseInlineList(value: unknown): string[] | undefined {
    if (Array.isArray(value)) return value as string[];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return [];
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const result: SpecFrontmatter = {
    ...parsed,
    item: (typeof parsed.item === "string" ? parsed.item : (parsed.item ?? "")) as string,
    updated: (typeof parsed.updated === "string" ? parsed.updated : (parsed.updated ?? "")) as string,
    status: (typeof parsed.status === "string" ? parsed.status : (parsed.status ?? "")) as string,
    schemaVersion:
      typeof parsed.schemaVersion === "number" ? String(parsed.schemaVersion) :
      typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : "1",
    spec: typeof parsed.spec === "string" ? parsed.spec : undefined,
    version: typeof parsed.version === "string" ? parsed.version : undefined,
    outcome: typeof parsed.outcome === "string" ? parsed.outcome : undefined,
    context: typeof parsed.context === "string" ? parsed.context : undefined,
    dependsOn: parseInlineList(parsed.dependsOn),
    supersededBy: typeof parsed.supersededBy === "string" ? parsed.supersededBy : (parsed.supersededBy === null ? null : undefined),
    reviewedAt: typeof parsed.reviewedAt === "string" ? parsed.reviewedAt : (parsed.reviewedAt === null ? null : undefined),
    reviewedBy: typeof parsed.reviewedBy === "string" ? parsed.reviewedBy : (parsed.reviewedBy === null ? null : undefined),
    acCount: typeof parsed.acCount === "number" ? parsed.acCount : (typeof parsed.acCount === "string" ? (Number.isNaN(Number(parsed.acCount)) ? undefined : Number(parsed.acCount)) : undefined),
    acResolved: typeof parsed.acResolved === "number" ? parsed.acResolved : (typeof parsed.acResolved === "string" ? (Number.isNaN(Number(parsed.acResolved)) ? undefined : Number(parsed.acResolved)) : undefined),
  };

  return result;
}

