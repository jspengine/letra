import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";

export async function specNew(name: string) {
	const root = resolve(process.cwd());
	const letraDir = join(root, ".letra");
	const specDir = join(letraDir, "specs", name);

	const spinner = ora(`Creating spec "${name}"...`).start();

	if (!existsSync(letraDir)) {
		spinner.fail(chalk.red(".letra/ not found. Run 'letra init' first."));
		process.exit(1);
	}

	if (existsSync(specDir)) {
		spinner.warn(chalk.yellow(`Spec "${name}" already exists`));
		return;
	}

	try {
		mkdirSync(specDir, { recursive: true });

		const specContent = `# Spec: ${name}

## Outcome
O que o usuário consegue fazer quando isso estiver pronto.

## Constraints
Limitações técnicas e de negócio que não podem ser violadas.

## Exclusions
O que explicitamente NÃO está neste escopo.

## Acceptance Criteria
- [ ] **Critério 1**: Descrição binária (passa/falha).

## Context
Por que estamos construindo isso. Trade-offs considerados.
`;

		const acceptanceContent = `# Acceptance Criteria — ${name}

- [ ] **Critério 1**: Descrição binária (passa/falha).
`;

		const statusContent = `# Status — ${name}

**Spec:** \`.letra/specs/${name}/spec.md\`
**Status:** pending
**Last sync:** ${new Date().toISOString().split("T")[0]}

## Progresso

- [ ] Implementado
`;

		writeFileSync(join(specDir, "spec.md"), specContent);
		writeFileSync(join(specDir, "acceptance.md"), acceptanceContent);
		writeFileSync(join(specDir, "status.md"), statusContent);

		spinner.succeed(
			chalk.green(`Spec "${name}" created at .letra/specs/${name}/`),
		);
	} catch (error) {
		spinner.fail(chalk.red("Failed to create spec"));
		process.exit(1);
	}
}
