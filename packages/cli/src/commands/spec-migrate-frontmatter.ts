/**
 * CLI command: letra spec migrate-frontmatter — migra specs legados para frontmatter YAML v1.
 *
 * AC4, AC5: Detecta specs sem frontmatter e migra para v1.
 */

import { Command } from "commander";
import { migrateAllSpecsToFrontmatterV1 } from "../spec-frontmatter/migrate.js";
import { validateAllSpecsFrontmatter } from "../spec-frontmatter/validate.js";
import { getLetraDir } from "../workspace/resolver.js";

export default function specMigrateFrontmatterCommand(): Command {
  const cmd = new Command("spec migrate-frontmatter").description(
    "Migra specs sem frontmatter YAML para o schema v1 (modo legado → frontmatter)",
  );

  cmd.option("--dry-run", "Mostra o que seria migrado sem escrever");

  cmd.action(async (options) => {
      const cwd = process.cwd();
      const letraDir = getLetraDir(cwd);

      if (!letraDir) {
        console.error("❌ Não foi possível localizar o diretório .letra. Execute dentro de um workspace Letra.");
        process.exit(1);
      }

      const workspaceRoot = process.env.LETRA_WORKSPACE_ROOT || cwd;

      // Valida antes da migração
      const { results: beforeResults } = validateAllSpecsFrontmatter(workspaceRoot);
      const legacyCount = [...beforeResults.values()].filter(
        (r) => r.issues.some((i) => i.code === "LEGACY_NO_FRONTMATTER"),
      ).length;

      if (legacyCount === 0) {
        console.log("✅ Todas as specs já possuem frontmatter YAML. Nada a migrar.");
        return;
      }

      console.log(`\n📋 ${legacyCount} spec(s) sem frontmatter YAML detectada(s).`);

      if (options.dryRun) {
        console.log("\n🔍 MODO DRY-RUN — nada será escrito.\n");
      }

      const report = migrateAllSpecsToFrontmatterV1(workspaceRoot);

      console.log(`\n═══ RELATÓRIO DE MIGRAÇÃO ═══`);
      console.log(`Tempo: ${report.timestamp}`);
      console.log(`Workspace: ${report.workspaceRoot}`);
      console.log(`Specs analisadas: ${report.totalSpecs}`);
      console.log(`Migradas: ${report.migratedSpecs}`);
      console.log(``);

      for (const entry of report.entries) {
        if (!entry.migrated) {
          console.log(`⏭️  ${entry.specId}: já possui frontmatter (ignorado)`);
          continue;
        }

        console.log(`\n✅ ${entry.specId}:`);
        console.log(`   Caminho: ${entry.specPath}`);
        console.log(`   Campos inferidos: ${entry.inferredFields.join(", ") || "nenhum"}`);

        if (entry.missingFields.length > 0) {
          console.log(`   Campos ausentes: ${entry.missingFields.join(", ")}`);
        }

        if (entry.errors.length > 0) {
          console.log(`   ⚠ Erros: ${entry.errors.join("; ")}`);
        }
      }

      // Valida após migração
      console.log(`\n═══ VALIDAÇÃO PÓS-MIGRAÇÃO ═══`);
      const { results: afterResults } = validateAllSpecsFrontmatter(workspaceRoot);
      const errorsAfter = [...afterResults.values()].filter((r) => !r.valid).length;
      const warningsAfter = [...afterResults.values()].reduce(
        (acc, r) => acc + r.issues.filter((i) => i.severity === "warning").length,
        0,
      );

      console.log(`Errors: ${errorsAfter}`);
      console.log(`Warnings: ${warningsAfter}`);

      if (errorsAfter > 0) {
        console.log(`\n❌ A migração introduziu erros. Verifique os arquivos.`);
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(`\n🔍 Modo dry-run: nada foi escrito.`);
      } else {
        console.log(`\n✅ Migração concluída com sucesso.`);
      }
    });

  return cmd;
}
