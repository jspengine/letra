import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";

export async function validate(targetPath?: string) {
  const root = resolve(process.cwd(), targetPath || ".");
  const specsDir = join(root, ".letra", "specs");

  if (!existsSync(specsDir)) {
    console.log(chalk.red("Error: .letra/specs/ not found. Run 'letra init' first."));
    process.exit(1);
  }

  console.log(chalk.bold("\nLetra Validation\n"));

  const entries = readdirSync(specsDir, { withFileTypes: true });
  let totalPass = 0;
  let totalFail = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const acceptanceFile = join(specsDir, entry.name, "acceptance.md");
    if (!existsSync(acceptanceFile)) {
      console.log(chalk.gray(`  Spec "${entry.name}" — no acceptance.md, skipping`));
      continue;
    }

    const content = readFileSync(acceptanceFile, "utf-8");
    const criteria = content.match(/- \[ \] \*\*(.+?)\*\*: (.+)/g) || [];

    console.log(chalk.bold(`  Spec: ${entry.name}`));

    if (criteria.length === 0) {
      console.log(chalk.gray("    No criteria found"));
      continue;
    }

    for (const line of criteria) {
      const match = line.match(/- \[ \] \*\*(.+?)\*\*: (.+)/);
      if (match) {
        const [, label, description] = match;
        // In v0.1, validation is manual — the agent reads and reports
        console.log(`    [ ] ${chalk.cyan(label)}: ${description}`);
        totalFail++;
      }
    }
    console.log("");
  }

  if (totalFail === 0) {
    console.log(chalk.green("No criteria to validate"));
  } else {
    console.log(chalk.yellow(`  ${totalFail} criterion/criteria pending validation`));
    console.log(chalk.gray("  Tip: In future versions, an AI agent will auto-validate these."));
  }

  process.exit(0);
}
