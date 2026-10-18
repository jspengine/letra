/**
 * CLI command: letra spec lint — valida frontmatter de specs.
 *
 * AC6: letra validate detecta specs com frontmatter inválido,
 * campos críticos faltando e inconsistências óbvias.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { validateAllSpecsFrontmatter, type SpecValidationIssue } from "../spec-frontmatter/validate.js";
import { getLetraDir } from "../workspace/resolver.js";

export default function specLintCommand(): Command {
  const cmd = new Command("spec lint").description(
    "Valida frontmatter YAML de todas as specs do workspace",
  );

  cmd.action(async () => {
      const cwd = process.cwd();
      const letraDir = getLetraDir(cwd);

      if (!letraDir) {
        console.error("❌ Não foi possível localizar o diretório .letra. Execute dentro de um workspace Letra.");
        process.exit(1);
      }

      const workspaceRoot = process.env.LETRA_WORKSPACE_ROOT || cwd;

      if (!readFileSync(join(letraDir, "workflow.json"), "utf-8")) {
        // Just check existence
      }

      const { results, hasErrors } = validateAllSpecsFrontmatter(workspaceRoot);

      if (results.size === 0) {
        console.log("ℹ️  Nenhuma spec encontrada em .letra/specs/");
        return;
      }

      let hasOutput = false;

      for (const [specId, result] of results) {
        if (result.issues.length === 0 && result.frontmatter) {
          // Spec válida — apenas mostre se houver verbosidade
          continue;
        }

        hasOutput = true;
        console.log(`\n📄 ${specId}:`);

        for (const issue of result.issues) {
          const icon = issue.severity === "error" ? "❌" : "⚠️ ";
          console.log(`  ${icon} [${issue.code}] ${issue.message}`);
        }
      }

      if (!hasOutput) {
        console.log("✅ Todas as specs possuem frontmatter YAML válido.");
        return;
      }

      const errorCount = [...results.values()].some((r) => !r.valid);
      if (errorCount) {
        console.log(`\n❌ ${errorCount} spec(s) com frontmatter inválido.`);
        process.exit(1);
      } else {
        console.log(`\n⚠️  Apenas warnings. Frontmatter está estruturalmente válido.`);
      }
    });

  return cmd;
}
