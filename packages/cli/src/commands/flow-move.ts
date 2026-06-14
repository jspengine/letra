import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, saveWorkflow } from "./flow-init.js";

function now(): string {
	return new Date().toISOString();
}

function resolveStage(
	workflow: { stages: Array<{ id: string; name: string }> },
	input: string,
): string | null {
	const lower = input.toLowerCase();
	for (const stage of workflow.stages) {
		if (stage.id === lower) return stage.id;
		if (stage.name.toLowerCase() === lower) return stage.id;
	}
	return null;
}

function adapterContent(
	workflowName: string,
	currentStageName: string,
	items: Array<{ id: string; description: string; stage: string }>,
	stageNames: Map<string, string>,
): string {
	const stageItems = items.filter(
		(item) =>
			item.stage === currentStageName.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
			stageNames.get(item.stage) === currentStageName,
	);

	const itemsBlock =
		stageItems.length > 0
			? stageItems.map((item) => `- ${item.id}: ${item.description}`).join("\n")
			: "(nenhum item ativo neste estagio)";

	return `# Letra Context — ${workflowName}

## Workflow

**Estagio atual:** ${currentStageName}

### Itens neste estagio

${itemsBlock}

### Regras

- Leia as specs em .letra/specs/ antes de codificar
- Execute \`letra validate\` para verificar acceptance criteria
- Siga a constitution.md rigorosamente
- Ao concluir, mova o item com \`letra flow move <id> --to <proximo_estagio>\`
`;
}

function generateAdapters(root: string, tools: string[], content: string): void {
	const adapters: Array<{ path: string; content: string }> = [];

	const header = `# Gerado por letra flow move. Nao edite manualmente.
`;

	for (const tool of tools) {
		switch (tool) {
			case "cursor":
				adapters.push({
					path: join(root, ".cursorrules"),
					content: header + content,
				});
				break;
			case "claude-code":
				adapters.push({
					path: join(root, "CLAUDE.md"),
					content: header + content,
				});
				break;
			case "windsurf":
				adapters.push({
					path: join(root, ".windsurfrules"),
					content: header + content,
				});
				break;
			case "vscode": {
				const dir = join(root, ".github");
				if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
				adapters.push({
					path: join(dir, "copilot-instructions.md"),
					content: header + content,
				});
				break;
			}
			case "opencode":
				adapters.push({
					path: join(root, "AGENTS.md"),
					content: header + content,
				});
				break;
		}
	}

	for (const { path, content: fileContent } of adapters) {
		const dir = join(path, "..");
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(path, fileContent);
		console.log(`  ${chalk.gray("Updated")} ${path.replace(`${root}/`, "")}`);
	}
}

export function flowMove(root: string, itemId: string, targetStageInput: string): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}

	const item =
		workflow.items.find((i) => i.id === itemId) ||
		workflow.items.find((i) => i.description === itemId);
	if (!item) {
		console.log(chalk.red(`Item "${itemId}" not found`));
		process.exit(1);
	}

	const targetStageId = resolveStage(workflow, targetStageInput);
	if (!targetStageId) {
		const valid = workflow.stages.map((s) => `${s.id} (${s.name})`).join(", ");
		console.log(chalk.red(`Stage "${targetStageInput}" not found. Valid stages: ${valid}`));
		process.exit(1);
	}

	if (item.stage === targetStageId) {
		console.log(chalk.yellow(`Item ${itemId} is already in stage "${targetStageId}"`));
		return;
	}

	const fromStage = workflow.stages.find((s) => s.id === item.stage)?.name || item.stage;
	const toStage = workflow.stages.find((s) => s.id === targetStageId)?.name || targetStageId;

	item.stage = targetStageId;
	workflow.updatedAt = now();
	saveWorkflow(root, workflow);

	const stageNames = new Map(workflow.stages.map((s) => [s.id, s.name]));
	const currentStageName = stageNames.get(targetStageId) || targetStageId;

	const content = adapterContent(workflow.name, currentStageName, workflow.items, stageNames);

	generateAdapters(root, workflow.tools, content);

	console.log(
		`  ${chalk.green("✓")} Item ${chalk.cyan(itemId)} moved: ${chalk.yellow(fromStage)} → ${chalk.green(toStage)}`,
	);
	console.log(`  ${chalk.gray("Adapters regenerated for:")} ${workflow.tools.join(", ")}`);
}

export function flowMoveAction(
	targetPath: string | undefined,
	itemId: string,
	options: { to: string },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowMove(root, itemId, options.to);
}
