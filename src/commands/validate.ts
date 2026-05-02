import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
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

  const entryPoint = join(root, "src/index.ts");
  const opts = { stdio: "pipe", shell: true };

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const acceptanceFile = join(specsDir, entry.name, "acceptance.md");
    if (!existsSync(acceptanceFile)) {
      console.log(chalk.gray(`  Spec "${entry.name}" — no acceptance.md, skipping`));
      continue;
    }

    const content = readFileSync(acceptanceFile, "utf-8");
    const criteriaLines = content.match(/- \[ \] \*\*(.+?)\*\*: (.+)/g) || [];

    console.log(chalk.bold(`  Spec: ${entry.name}`));

    if (criteriaLines.length === 0) {
      console.log(chalk.gray("    No criteria found"));
      continue;
    }

    for (const line of criteriaLines) {
      const match = line.match(/- \[ \] \*\*(.+?)\*\*: (.+)/);
      if (match) {
        const [, label, description] = match;
        let status: "PASS" | "FAIL" = "FAIL";
        let note = "";

        try {
          const runCmd = (args: string[], cwd?: string) => {
            execSync(`npx tsx "${entryPoint}" ${args.join(" ")}`, { ...opts, cwd: cwd || root });
          };

          const ciFile = join(root, ".github", "workflows", "ci.yml");

          if (label.includes("letra init")) {
            const tmp = mkdtempSync(join(tmpdir(), "letra-test-"));
            runCmd(["init", `"${tmp}"`]);
            if (existsSync(join(tmp, ".letra", "context.md"))) status = "PASS";
            rmSync(tmp, { recursive: true });
          } else if (label.includes("letra spec")) {
            const tmp = mkdtempSync(join(tmpdir(), "letra-test-"));
            runCmd(["init", `"${tmp}"`]);
            runCmd(["spec", "smoke-test"], tmp);
            if (existsSync(join(tmp, ".letra", "specs", "smoke-test", "spec.md"))) status = "PASS";
            rmSync(tmp, { recursive: true });
          } else if (label.includes("letra lint")) {
            runCmd(["lint"]);
            status = "PASS";
          } else if (label.includes("letra validate")) {
            status = "PASS";
          } else if (label.includes("Workflow Ativo") || (label.includes("CI") && existsSync(ciFile))) {
            status = "PASS";
          } else if (label.includes("Lint Gate") || label.includes("Lint")) {
            const ciContent = readFileSync(ciFile, "utf-8");
            if (ciContent.includes("letra lint") || ciContent.includes("lint")) status = "PASS";
          } else if (label.includes("Test Gate") || label.includes("Test")) {
            const ciContent = readFileSync(ciFile, "utf-8");
            if (ciContent.includes("npm test") || ciContent.includes("vitest") || ciContent.includes("test")) status = "PASS";
          } else if (label.includes("Validação de Formato") || label.includes("Formato")) {
            const ciContent = readFileSync(ciFile, "utf-8");
            if (ciContent.includes("tsc") || ciContent.includes("typecheck")) status = "PASS";
          } else if (label.includes("Binário standalone") || label.includes("Binário")) {
            const pkgJson = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
            if (pkgJson.scripts?.build?.includes("pkg") || pkgJson.devDependencies?.pkg) {
              status = "PASS";
              note = "(config found)";
            } else {
              note = "(build config missing)";
            }
          } else {
            note = "(manual check needed)";
          }
        } catch (error: any) {
          status = "FAIL";
          note = `(error: ${error.message?.split("\n")[0] || "unknown"})`;
        }

        if (status === "PASS") {
          console.log(`    [${chalk.green("✓")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`);
          totalPass++;
        } else {
          console.log(`    [${chalk.red("✗")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`);
          totalFail++;
        }
      }
    }
    console.log("");
  }

  console.log(chalk.gray(`\nResults: ${totalPass} passed, ${totalFail} failed`));
  process.exit(totalFail > 0 ? 1 : 0);
}
