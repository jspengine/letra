import { mkdirSync, writeFileSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function init(targetPath?: string) {
  const root = resolve(process.cwd(), targetPath || ".");
  const letraDir = join(root, ".letra");

  const spinner = ora("Initializing Letra...").start();

  if (existsSync(letraDir)) {
    spinner.warn(chalk.yellow(".letra/ already exists"));
    return;
  }

  try {
    // Create directory structure
    mkdirSync(join(letraDir, "decisions"), { recursive: true });
    mkdirSync(join(letraDir, "specs", "_template"), { recursive: true });
    mkdirSync(join(letraDir, "adapters"), { recursive: true });

    // Copy templates from the package's .letra/ directory
    const templateDir = join(__dirname, "..", ".letra");

    const templates = ["context.md", "constitution.md", "glossary.md", "lessons-learned.md"];
    for (const file of templates) {
      const src = join(templateDir, file);
      const dest = join(letraDir, file);
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    }

    // Create spec template
    const specTemplate = join(letraDir, "specs", "_template.md");
    const specContent = `# Spec Template

## Outcome
O que o usuário consegue fazer quando isso estiver pronto.

## Constraints
Limitações técnicas e de negócio que não podem ser violadas.

## Exclusions
O que explicitamente NÃO está neste escopo.

## Acceptance Criteria
- [ ] **Critério 1**: Descrição binária (passa/falha).

## Context
Por que estamos construindo isso.
`;
    writeFileSync(specTemplate, specContent);

    spinner.succeed(chalk.green(".letra/ initialized successfully"));
    console.log("");
    console.log("  Next steps:");
    console.log(`    ${chalk.cyan("letra spec new <name>")}  Create your first spec`);
    console.log(`    ${chalk.cyan("letra lint")}             Validate specs`);
  } catch (error) {
    spinner.fail(chalk.red("Failed to initialize Letra"));
    process.exit(1);
  }
}
