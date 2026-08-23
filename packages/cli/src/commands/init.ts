import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import { flowServeAction } from "./flow-serve.js";
import { generateAdapters } from "../adapters/generate.js";
import { supportedAdapterTools } from "../adapters/registry.js";
import { detectLanguage } from "../adapters/language-registry.js";
import { writeWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";
import { initWorkspace, ensureDefaultHarness } from "../workspace/index.js";
import { LINK_FILE, clearWorkspaceCache, getLetraDir } from "./../workspace/resolver.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function ask(query: string, options: string[]): Promise<string> {
	if (!process.stdin.isTTY) return Promise.resolve(options[0]);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		const formatted = `${chalk.cyan(query)} ${options.map((o) => chalk.gray(`(${o})`)).join(" ")}\n> `;
		rl.question(formatted, (answer) => {
			rl.close();
			const trimmed = answer.trim().toLowerCase();
			if (trimmed && options.some((o) => o.toLowerCase().startsWith(trimmed))) {
				resolve(options.find((o) => o.toLowerCase().startsWith(trimmed)) ?? options[0]);
			} else if (trimmed && options.includes(trimmed)) {
				resolve(trimmed);
			} else {
				resolve(options[0]);
			}
		});
	});
}

function adaptConfig(projectType: string): string {
	const config: Record<
		string,
		{
			severity: string;
			minChars?: number;
			maxDays?: number;
			blacklist?: string[];
		}
	> = {
		"conteudo-minimo": { severity: "warning", minChars: 50 },
		"consistencia-terminologia": { severity: "warning" },
		"detecao-tom": {
			severity: "warning",
			blacklist: ["tipo", "tá", "pra", "blz", "kkk", "eita", "oi", "oi pessoal"],
		},
		"drift-temporal": { severity: "warning", maxDays: 30 },
		"secoes-vazias": { severity: "warning" },
		"acs-sem-metrica": { severity: "warning" },
		"baixa-confianca": { severity: "warning" },
	};

	if (projectType === "library") {
		config["detecao-tom"] = { severity: "off" };
		config["drift-temporal"] = { severity: "warning", maxDays: 60 };
	} else if (projectType === "mobile") {
		config["drift-temporal"] = { severity: "error", maxDays: 14 };
		config["baixa-confianca"] = { severity: "error" };
	} else if (projectType === "cli") {
		config["detecao-tom"] = { severity: "off" };
	}
	return JSON.stringify({ heuristics: config }, null, 2);
}

const adapterTools = supportedAdapterTools();
const TOOL_MAP: Record<string, string[]> = Object.fromEntries([
	...adapterTools.flatMap((adapter) => [
		[adapter.id, [adapter.id]],
		[adapter.label.toLowerCase(), [adapter.id]],
	] as Array<[string, string[]]>),
	["todos", adapterTools.map((adapter) => adapter.id)],
]);

function normalizedPath(path: string): string {
	return path.replace(/\\/g, "/");
}

function stableLocationId(path: string): string {
	const normalized = normalizedPath(path).toLowerCase();
	let hash = 2166136261;
	for (const char of normalized) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const name = normalized.split("/").filter(Boolean).pop()
		?.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 32) || "project";
	return `loc-${name}-${(hash >>> 0).toString(36)}`;
}

function externalWorkspaceWorkflow(workspaceName: string, projectRoot: string, harnessVersion: string): Workflow {
	const now = new Date().toISOString();
	const locationPath = normalizedPath(projectRoot);
	return {
		version: "1.0",
		name: workspaceName,
		createdAt: now,
		updatedAt: now,
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "design", name: "Design", order: 1, zone: "doing" },
			{ id: "code", name: "Code", order: 2, zone: "doing" },
			{ id: "review", name: "Review", order: 3, zone: "doing" },
			{ id: "done", name: "Done", order: 4, zone: "done" },
		],
		items: [],
		tools: [],
		template: "flow-main",
		harnessVersion,
		locations: [{
			id: stableLocationId(locationPath),
			path: locationPath,
			label: basename(projectRoot) || workspaceName,
			adapters: [],
		}],
	};
}

export async function init(targetPath?: string, options?: { yes?: boolean; serve?: boolean; workspace?: string; noTui?: boolean }) {
	const root = resolve(process.cwd(), targetPath || ".");

	if (options?.workspace) {
		const spinner = ora("Creating workspace...").start();
		try {
			mkdirSync(root, { recursive: true });
			const { workspaceDir, info } = initWorkspace(options.workspace);
			ensureDefaultHarness(info.harnessVersion);
			const workflow = externalWorkspaceWorkflow(options.workspace, root, info.harnessVersion);
			writeFileSync(join(workspaceDir, "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");
			writeFileSync(join(root, LINK_FILE), `${workspaceDir}\n`, "utf-8");
			clearWorkspaceCache();
			spinner.succeed(chalk.green(`Workspace "${options.workspace}" created`));
			console.log(`  ${chalk.gray("Data dir:")}  ${workspaceDir}`);
			console.log(`  ${chalk.gray("Project:")}   ${root}`);
			console.log(`  ${chalk.gray("Link:")}      ${join(root, LINK_FILE)}`);
			console.log(`  ${chalk.gray("Harness:")}   ${info.harnessVersion}`);
			console.log("");
			console.log("  Next steps:");
			console.log(`    ${chalk.cyan("letra status")}               View workspace info`);
			console.log(`    ${chalk.cyan("letra flow backlog")}         Manage backlog items`);
			return;
		} catch (error) {
			spinner.fail(chalk.red("Failed to create workspace"));
			if (error instanceof Error) console.error(chalk.red(`  ${error.message}`));
			process.exit(1);
		}
	}

	const letraDir = getLetraDir(root);

	if (existsSync(letraDir)) {
		if (options?.serve) {
			console.log(chalk.cyan(".letra/ already exists — starting UI..."));
			await flowServeAction(targetPath, { open: true });
			return;
		}
		console.log(chalk.yellow(".letra/ already exists"));
		return;
	}

	const spinner = ora("Initializing Letra...").start();

	try {
		let projectType = "web-app";
		let tool = "todos";

		if (options?.yes || !process.stdin.isTTY) {
			// use defaults
		} else if (options?.noTui !== false) {
			spinner.stop();
			try {
				const { runInitWizard } = await import("../tui/init-wizard.js");
				const result = await runInitWizard();
				projectType = result.projectType;
				tool = result.tool;
			} catch {
				projectType = "web-app";
				tool = "todos";
			}
			spinner.start();
		} else {
			spinner.stop();

			projectType = await ask("Project type?", ["web-app", "cli", "library", "mobile"]);
			const toolNames = [...adapterTools.map((adapter) => adapter.label), "Todos"];
			const answer = await ask("AI coding agent?", toolNames);
			tool = answer.toLowerCase();

			spinner.start();
		}

		mkdirSync(join(letraDir, "decisions"), { recursive: true });
		mkdirSync(join(letraDir, "specs", "_template"), { recursive: true });
		mkdirSync(join(letraDir, "adapters"), { recursive: true });

		const lang = detectLanguage(root);
		const langDisplay = lang ?? "general";

		const stackLine = lang
			? `- **Stack**: ${lang}`
			: "- Sem stack específica (projeto general)";

		const codeRules = lang === "Node.js"
			? "- TypeScript estrito (strict: true)\n- Zero dependencies desnecessárias"
			: "- Código limpo e documentado\n- Seguir convenções do ecossistema";

		const templateFiles: Record<string, string> = {
			"context.md": `# Context

> Updated: 2026-06-16
> Owner: time

## Intent

Este projeto segue Specification-Driven Development (SDD).
Capturamos direção, intenção e contexto para enriquecer prompts de agentes de IA.

## Domínio

- ${stackLine}
- Ferramenta: .letra/ memory format
- Público: equipe de desenvolvimento

## Restrições Reais

- Specs devem ser thin (máx 1 página por feature)
- Sem lock-in de IDE
- Drift detection deve funcionar para qualquer domínio (não só código)
`,
			"constitution.md": `# Constitution

## Arquitetura
- Adapter layer desde o dia 1 — nunca travar em uma IDE
- Formato .letra/ é a fonte da verdade, não o código
- CLI deve ser extensível via plugins

## Código
${codeRules}

## Specs
- Thin specs: máximo 1 página por feature
- Markdown checklist para acceptance criteria
- Toda spec deve ter: Outcome, Constraints, Exclusions, Acceptance Criteria, Context

## Segurança
- Nunca incluir secrets, tokens ou chaves no repositório
`,
			"glossary.md": `# Glossary

| Termo | Definição |
|-------|-----------|
| **Spec** | Especificação thin que define o que deve ser construído. |
| **Drift** | Divergência entre o que a spec diz e o que o artefato realmente entrega. |
| **Adapter** | Tradutor que converte .letra/ para o formato que uma IDE/agent entende. |
| **Context** | Documento que captura intent, domínio, restrições reais e "porquês" do projeto. |
| **Constitution** | Regras não-negociáveis de arquitetura, código e workflow. |
| **Thin Spec** | Spec de no máximo 1 página, focada em outcome. |
`,
			"lessons-learned.md": `# Lessons Learned

## O que funcionou
- Pesquisar dores reais do SDD antes de definir arquitetura
- Decidir por evidências (métricas, dados) e não por intuição

## O que aprendemos
- Drift detection não pode ser code-centric — público primário são não-devs
- Obsidian nunca deve ser requisito — barreira de adoção
- Specs thin focadas em outcome reduzem atrito

## Padrões a evitar
- Specs gigantes (Markdown Madness)
- Lock-in de IDE
- Spec que vira pseudo-código
`,
		};
		for (const [file, content] of Object.entries(templateFiles)) {
			writeFileSync(join(letraDir, file), content, "utf-8");
		}

		const specTemplate = join(letraDir, "specs", "_template.md");
		const specContent = `# Spec Template

> Updated: YYYY-MM-DD

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

		const configPath = join(letraDir, "config.json");
		writeFileSync(configPath, adaptConfig(projectType));
		console.log(`    ${chalk.gray("Created")} .letra/config.json`);

		const tools = TOOL_MAP[tool] || TOOL_MAP.todos;
		generateAdapters(root, tools, { source: "init" });

		if ((tool === "todos" || tool === "vscode") && lang === "Node.js") {
			const vscodeDir = join(root, ".vscode");
			if (!existsSync(vscodeDir)) mkdirSync(vscodeDir, { recursive: true });
			const vscodeSettingsPath = join(vscodeDir, "settings.json");
			const vscodeSettingsContent = `{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.autoSave": "onFocusChange"
}
`;
			writeFileSync(vscodeSettingsPath, vscodeSettingsContent);
			console.log(`    ${chalk.gray("Created")} .vscode/settings.json`);
		}

		spinner.succeed(chalk.green(".letra/ initialized successfully"));
		console.log("");
		console.log("  Next steps:");
		console.log(`    ${chalk.cyan("letra spec new <name>")}  Create your first spec`);
		console.log(`    ${chalk.cyan("letra lint")}             Validate specs`);
		console.log(`    ${chalk.cyan("letra init --serve")}   Open web UI to configure workflow`);

		if (lang) {
			const workflow: Workflow = {
				version: "1.0",
				name: resolve(root).split(/[\\/]/).pop() || "meu-projeto",
				language: lang,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				stages: [
					{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
					{ id: "design", name: "Design", order: 1, zone: "doing" },
					{ id: "code", name: "Code", order: 2, zone: "doing" },
					{ id: "review", name: "Review", order: 3, zone: "doing" },
					{ id: "done", name: "Done", order: 4, zone: "done" },
				],
				items: [],
				tools,
			};
			writeWorkflow(root, { workflow, source: "init", skipSitrep: true, quiet: true });
		}

		if (options?.serve) {
			console.log(`\n${chalk.cyan("Opening web UI...")}\n`);
			await flowServeAction(targetPath, { open: true });
			return;
		}
	} catch (error) {
		spinner.fail(chalk.red("Failed to initialize Letra"));
		process.exit(1);
	}
}
