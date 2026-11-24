/**
 * Tipos para o parser de frontmatter YAML de specs.
 *
 * AC3: Parser é único e compartilhado entre CLI, Web e MCP.
 * Este arquivo é a interface pública do módulo.
 */

export interface SpecFrontmatter {
  /** Versão do schema do frontmatter (ex: "1") */
  schemaVersion?: string;

  /** ID do item associado (ex: "ITEM-30") — obrigatório em v1 */
  item: string;

  /** ID da spec (ex: "spec-frontmatter") — opcional em v1 */
  spec?: string;

  /** Versão semântica da spec (ex: "1.0.0") — opcional em v1 */
  version?: string;

  /** Data de atualização no formato ISO (ex: "2026-09-21") — obrigatório em v1 */
  updated: string;

  /** Status do item/spec (ex: "backlog", "design", "code", "review", "done") — obrigatório em v1 */
  status: string;

  /** Outcome descritivo — opcional em v1 */
  outcome?: string;

  /** Contexto — opcional em v1 */
  context?: string;

  /** Dependências de specs — opcional em v1 */
  dependsOn?: string[];

  /** Spec que substituiu esta (se arquivada) — opcional em v1 */
  supersededBy?: string | null;

  /** Data de revisão — opcional em v1 */
  reviewedAt?: string | null;

  /** Quem revisou — opcional em v1 */
  reviewedBy?: string | null;

  /** Contagem total de ACs — opcional em v1 */
  acCount?: number;

  /** Contagem de ACs resolvidos — opcional em v1 */
  acResolved?: number;

  /** Qualquer campo adicional ignorado pelo parser com aviso */
  [key: string]: unknown;
}

export interface SpecParseWarning {
  message: string;
}

export interface SpecParseError {
  code: string;
  message: string;
  /** Frontmatter field the error refers to, when there is one. */
  field?: string;
}

export interface SpecParseResult {
  data: SpecFrontmatter | null;
  warnings: SpecParseWarning[];
  errors: SpecParseError[];
  /**
   * True when the spec has no YAML frontmatter and `data` was inferred by the
   * transitional legacy heuristic. Legacy specs are reported as warnings.
   */
  legacy?: boolean;
}

export type SpecSchemaVersion = "1";

export const SPEC_FRONTMATTER_KNOWN_FIELDS_V1 = [
  "schemaVersion",
  "item",
  "spec",
  "version",
  "updated",
  "status",
  "outcome",
  "context",
  "dependsOn",
  "supersededBy",
  "reviewedAt",
  "reviewedBy",
  "acCount",
  "acResolved",
] as const;
