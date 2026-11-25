/**
 * Utilitário de migração de specs legados para frontmatter YAML v1.
 *
 * AC4: Specs sem frontmatter são detectados como legado.
 * AC5: Migrador idempotente transforma specs legados em frontmatter v1.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseSpecFrontmatter } from "./parser.js";
import type { SpecFrontmatter } from "./types.js";

export interface MigrationReportEntry {
  specId: string;
  specPath: string;
  migrated: boolean;
  frontmatterWritten: boolean;
  inferredFields: string[];
  missingFields: string[];
  errors: string[];
}

export interface MigrationReport {
  timestamp: string;
  workspaceRoot: string;
  totalSpecs: number;
  migratedSpecs: number;
  entries: MigrationReportEntry[];
}

/**
 * Detecta se uma spec já possui frontmatter YAML.
 */
export function hasFrontmatter(specText: string): boolean {
  const lines = specText.split("\n");
  return lines.length >= 3 && lines[0].trim() === "---";
}

/**
 * Extrai metadados de um spec legado via heurística básica.
 * Não é perfeito — reporta o que foi inferido vs o que ficou incerto.
 */
export function extractLegacyMetadata(specText: string, specId: string): {
  data: Partial<SpecFrontmatter>;
  inferred: string[];
  missing: string[];
  errors: string[];
} {
  const result = {
    data: {} as Partial<SpecFrontmatter>,
    inferred: [] as string[],
    missing: [] as string[],
    errors: [] as string[],
  };

  // Tenta extrair item do header "> Item: ITEM-XX"
  const itemMatch = specText.match(/>\s*Item:\s*(ITEM-\d+)/i);
  if (itemMatch) {
    result.data.item = itemMatch[1];
    result.inferred.push("item (do header > Item:)");
  } else {
    result.missing.push("item");
    result.errors.push("não foi possível inferir item do header do spec");
  }

  // Tenta extrair updated do header "> Updated: YYYY-MM-DD"
  const updatedMatch = specText.match(/>\s*Updated:\s*(.+?)(?:\n|$)/i);
  if (updatedMatch) {
    let updated = updatedMatch[1].trim();
    // Normaliza formato de data
    if (/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
      // já está em ISO
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(updated)) {
      const [dd, mm, yyyy] = updated.split("/");
      updated = `${yyyy}-${mm}-${dd}`;
    } else {
      // Tenta converter
      const parsed = new Date(updated);
      if (!isNaN(parsed.getTime())) {
        updated = parsed.toISOString().slice(0, 10);
      }
    }
    result.data.updated = updated;
    result.inferred.push("updated (do header > Updated:)");
  } else {
    result.missing.push("updated");
    result.errors.push("não foi possível inferir updated do header do spec");
  }

  // Tenta extrair status do header "> Status: ..."
  const statusMatch = specText.match(/>\s*Status:\s*(.+?)(?:\n|$)/i);
  if (statusMatch) {
    result.data.status = statusMatch[1].trim();
    result.inferred.push("status (do header > Status:)");
  } else {
    result.missing.push("status");
    result.errors.push("não foi possível inferir status do header do spec");
  }

  // Tenta extrair spec (nome do diretório)
  result.data.spec = specId;

  // Tenta contagem de ACs do acceptance.md
  const acceptancePath = join(
    join(specText.split("\n")[0] ? "" : ""), // not useful
  );

  return result;
}

/**
 * Gera frontmatter YAML v1 a partir de metadados.
 */
export function generateFrontmatterYaml(data: Partial<SpecFrontmatter>): string {
  const lines = ["---"];

  if (data.schemaVersion) {
    lines.push(`schemaVersion: "${data.schemaVersion}"`);
  } else {
    lines.push("schemaVersion: \"1\"");
  }

  if (data.item) {
    lines.push(`item: ${data.item}`);
  }

  if (data.spec) {
    lines.push(`spec: ${data.spec}`);
  }

  if (data.version) {
    lines.push(`version: "${data.version}"`);
  }

  if (data.updated) {
    lines.push(`updated: "${data.updated}"`);
  }

  if (data.status) {
    lines.push(`status: ${data.status}`);
  }

  if (data.outcome) {
    const outcomeLines = data.outcome.split("\n");
    if (outcomeLines.length > 1) {
      lines.push("outcome: |");
      for (const line of outcomeLines) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`outcome: "${data.outcome}"`);
    }
  }

  if (data.dependsOn && data.dependsOn.length > 0) {
    lines.push("dependsOn:");
    for (const dep of data.dependsOn) {
      lines.push(`  - ${dep}`);
    }
  }

  if (data.supersededBy !== undefined) {
    lines.push(`supersededBy: ${data.supersededBy === null ? "null" : data.supersededBy}`);
  }

  if (data.reviewedAt !== undefined) {
    lines.push(`reviewedAt: ${data.reviewedAt === null ? "null" : `"${data.reviewedAt}"`}`);
  }

  if (data.reviewedBy !== undefined) {
    lines.push(`reviewedBy: ${data.reviewedBy === null ? "null" : `"${data.reviewedBy}"`}`);
  }

  if (data.acCount !== undefined) {
    lines.push(`acCount: ${data.acCount}`);
  }

  if (data.acResolved !== undefined) {
    lines.push(`acResolved: ${data.acResolved}`);
  }

  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

/**
 * Migrar uma spec específica para frontmatter v1.
 * Retorna null se a spec já tiver frontmatter (idempotente).
 */
export function migrateSpecToFrontmatterV1(
  workspaceRoot: string,
  specId: string,
): MigrationReportEntry | null {
  const specPath = join(workspaceRoot, "specs", specId, "spec.md");

  if (!existsSync(specPath)) {
    return {
      specId,
      specPath,
      migrated: false,
      frontmatterWritten: false,
      inferredFields: [],
      missingFields: ["spec.md não encontrado"],
      errors: ["arquivo specs/" + specId + "/spec.md não existe"],
    };
  }

  const originalContent = readFileSync(specPath, "utf-8");

  // Verifica se já tem frontmatter
  if (hasFrontmatter(originalContent)) {
    // Idempotente: não migra specs que já têm frontmatter
    return {
      specId,
      specPath,
      migrated: false,
      frontmatterWritten: false,
      inferredFields: [],
      missingFields: [],
      errors: ["já possui frontmatter YAML — ignorado (idempotente)"],
    };
  }

  // Extrai metadados via heurística
  const { data, inferred, missing, errors } = extractLegacyMetadata(originalContent, specId);

  // Gera frontmatter YAML
  const frontmatterYaml = generateFrontmatterYaml(data);

  // Gera o novo conteúdo: frontmatter + corpo original (sem os headers antigos)
  let body = originalContent;

  // Remove headers antigos (> Item:, > Updated:, > Status:) se presentes
  body = body.replace(/^>\s*Item:.*$/gm, "").replace(/^>\s*Updated:.*$/gm, "").replace(/^>\s*Status:.*$/gm, "");

  // Remove linhas vazias consecutivas no início após remover headers
  body = body.replace(/^\n{2,}/, "\n");

  const newContent = frontmatterYaml + body;

  // Escreve o novo arquivo
  writeFileSync(specPath, newContent, "utf-8");

  return {
    specId,
    specPath,
    migrated: true,
    frontmatterWritten: true,
    inferredFields: inferred,
    missingFields: missing,
    errors,
  };
}

/**
 * Migrar todas as specs de um workspace para frontmatter v1.
 */
export function migrateAllSpecsToFrontmatterV1(
  workspaceRoot: string,
): MigrationReport {
  const specsDir = join(workspaceRoot, "specs");
  const entries: MigrationReportEntry[] = [];

  if (!existsSync(specsDir)) {
    return {
      timestamp: new Date().toISOString(),
      workspaceRoot,
      totalSpecs: 0,
      migratedSpecs: 0,
      entries,
    };
  }

  const specDirs = readdirSync(specsDir);
  let migratedCount = 0;

  for (const specId of specDirs) {
    const specPath = join(specsDir, specId, "spec.md");
    if (!existsSync(specPath)) continue;

    const entry = migrateSpecToFrontmatterV1(workspaceRoot, specId);
    if (entry) {
      entries.push(entry);
      if (entry.migrated) migratedCount++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    workspaceRoot,
    totalSpecs: entries.length,
    migratedSpecs: migratedCount,
    entries,
  };
}
