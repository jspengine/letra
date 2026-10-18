/**
 * Validação de frontmatter de specs contra o schema v1.
 *
 * AC6: letra validate detecta frontmatter inválido, campos críticos faltando
 * e inconsistências óbvias entre frontmatter e acceptance.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSpecFrontmatter,
  SPEC_FRONTMATTER_REQUIRED_FIELDS_V1,
  type SpecParseResult,
} from "./parser.js";
import type { SpecFrontmatter } from "./types.js";

export interface SpecValidationIssue {
  code:
    | "SPEC_FILE_MISSING"
    | "SPEC_FILE_NOT_READABLE"
    | "FRONTMATTER_INVALID"
    | "REQUIRED_FIELD_MISSING"
    | "INVALID_FIELD_TYPE"
    | "STATUS_UNKNOWN"
    | "DRIFT_FRONTMATTER_ACCEPTANCE"
    | "LEGACY_NO_FRONTMATTER";
  message: string;
  specId?: string;
  field?: string;
  severity: "error" | "warning";
}

export interface SpecValidationResult {
  valid: boolean;
  issues: SpecValidationIssue[];
  frontmatter: SpecFrontmatter | null;
}

/**
 * Valida o frontmatter de uma spec específica.
 */
export function validateSpecFrontmatter(
  workspaceRoot: string,
  specId: string,
): SpecValidationResult {
  const result: SpecValidationResult = {
    valid: true,
    issues: [],
    frontmatter: null,
  };

  const specPath = join(workspaceRoot, "specs", specId, "spec.md");

  if (!require("node:fs").existsSync?.(specPath)) {
    result.issues.push({
      code: "SPEC_FILE_MISSING",
      message: `arquivo specs/${specId}/spec.md não encontrado`,
      specId,
      severity: "error",
    });
    result.valid = false;
    return result;
  }

  let content: string;
  try {
    content = readFileSync(specPath, "utf-8");
  } catch {
    result.issues.push({
      code: "SPEC_FILE_NOT_READABLE",
      message: `não foi possível ler specs/${specId}/spec.md`,
      specId,
      severity: "error",
    });
    result.valid = false;
    return result;
  }

  const parseResult: SpecParseResult = parseSpecFrontmatter(content);

  // Propagate parse errors
  for (const err of parseResult.errors) {
    result.issues.push({
      code: "FRONTMATTER_INVALID",
      message: err.message,
      specId,
      severity: "error",
    });
    result.valid = false;
  }

  // Propagate warnings
  for (const warn of parseResult.warnings) {
    result.issues.push({
      code: "FRONTMATTER_INVALID",
      message: warn.message,
      specId,
      severity: "warning",
    });
  }

  if (parseResult.data) {
    result.frontmatter = parseResult.data;

    // Check required fields
    for (const field of SPEC_FRONTMATTER_REQUIRED_FIELDS_V1) {
      if (!(field in parseResult.data)) {
        result.issues.push({
          code: "REQUIRED_FIELD_MISSING",
          message: `campo obrigatório '${field}' ausente no frontmatter`,
          specId,
          field,
          severity: "error",
        });
        result.valid = false;
      }
    }

    // Check status enum (warning, not error — workspace can define its own statuses)
    const validStatuses = ["backlog", "design", "code", "review", "security", "done", "archived", "consolidated"];
    if ("status" in parseResult.data && typeof parseResult.data.status === "string") {
      if (!validStatuses.includes(parseResult.data.status)) {
        result.issues.push({
          code: "STATUS_UNKNOWN",
          message: `status '${parseResult.data.status}' não é um dos status conhecidos: ${validStatuses.join(", ")} (pode ser customizado pelo workspace)`,
          specId,
          field: "status",
          severity: "warning",
        });
      }
    }

    // Check drift between frontmatter status and acceptance.md
    checkDrift(result, workspaceRoot, specId, parseResult.data);
  } else {
    // No frontmatter parsed — legacy mode
    result.issues.push({
      code: "LEGACY_NO_FRONTMATTER",
      message: `spec ${specId} não possui frontmatter YAML estruturado (modo legado com heurística)`,
      specId,
      severity: "warning",
    });
  }

  return result;
}

/**
 * Verifica inconsistências entre frontmatter e acceptance.md.
 */
function checkDrift(
  result: SpecValidationResult,
  workspaceRoot: string,
  specId: string,
  frontmatter: SpecFrontmatter,
): void {
  const acceptancePath = join(workspaceRoot, "specs", specId, "acceptance.md");

  if (!require("node:fs").existsSync?.(acceptancePath)) {
    return;
  }

  let acceptanceContent: string;
  try {
    acceptanceContent = readFileSync(acceptancePath, "utf-8");
  } catch {
    return;
  }

  // Check: frontmatter says status "done" but acceptance has pending ACs
  if (frontmatter.status === "done") {
    const pendingACs = (acceptanceContent.match(/^- \[ \]\s*\*\*/g) || []).length;
    if (pendingACs > 0) {
      result.issues.push({
        code: "DRIFT_FRONTMATTER_ACCEPTANCE",
        message: `frontmatter status='done' mas acceptance.md tem ${pendingACs} AC(s) pendente(s) [ ]`,
        specId,
        severity: "warning",
      });
    }
  }

  // Check: frontmatter acResolved vs actual resolved count in acceptance
  if (
    typeof frontmatter.acResolved === "number" &&
    typeof frontmatter.acCount === "number" &&
    frontmatter.acCount > 0
  ) {
    const actualResolved = (acceptanceContent.match(/^- \[x\]\s*\*\*/g) || []).length;
    if (actualResolved !== frontmatter.acResolved) {
      result.issues.push({
        code: "DRIFT_FRONTMATTER_ACCEPTANCE",
        message: `frontmatter acResolved=${frontmatter.acResolved} mas acceptance.md tem ${actualResolved} AC(s) resolvido(s) [x]`,
        specId,
        severity: "warning",
      });
    }
  }
}

/**
 * Valida todas as specs de um workspace.
 */
export function validateAllSpecsFrontmatter(
  workspaceRoot: string,
): { results: Map<string, SpecValidationResult>; hasErrors: boolean } {
  const specsDir = join(workspaceRoot, "specs");
  const results = new Map<string, SpecValidationResult>();

  if (!require("node:fs").existsSync?.(specsDir)) {
    return { results, hasErrors: false };
  }

  const specDirs = require("node:fs").readdirSync(specsDir);
  let hasErrors = false;

  for (const specId of specDirs) {
    const specPath = join(specsDir, specId, "spec.md");
    if (!require("node:fs").existsSync?.(specPath)) continue;

    const result = validateSpecFrontmatter(workspaceRoot, specId);
    results.set(specId, result);
    if (!result.valid) hasErrors = true;
  }

  return { results, hasErrors };
}
