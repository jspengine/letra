/**
 * Módulo de parser de frontmatter YAML para specs do Letra.
 *
 * AC2: Especifica e consome SpecSchema v1 — campos obrigatórios, tipos, regras.
 * AC3: Parser único compartilhado entre CLI, Web e MCP — sem regex, sem parser duplicado.
 *
 * Este módulo substitui a extração de metadados via regex/heurística textual
 * por um parser YAML estruturado com schema versionado.
 */

export {
  parseSpecFrontmatter,
  SPEC_FRONTMATTER_SCHEMA_VERSION_V1,
  SPEC_FRONTMATTER_REQUIRED_FIELDS_V1,
  SPEC_FRONTMATTER_OPTIONAL_FIELDS_V1,
  type SpecFrontmatterRequiredFieldsV1,
  type SpecFrontmatterOptionalFieldsV1,
  type SpecFrontmatterKnownFieldV1,
} from "./parser.js";

export type {
  SpecFrontmatter,
  SpecParseWarning,
  SpecParseError,
  SpecParseResult,
  SpecSchemaVersion,
  SPEC_FRONTMATTER_KNOWN_FIELDS_V1,
} from "./types.js";
