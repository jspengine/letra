import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import { generateAdapters } from "../adapters/generate.js";
import { flowServeAction } from "./flow-serve.js";

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

function adaptersForTool(tool: string): string[] {
	const all = ["cursor", "claude-code", "windsurf", "vscode", "opencode"];
	if (tool === "todos") return all;
	const map: Record<string, string[]> = {
		opencode: ["opencode"],
		cursor: ["cursor"],
		windsurf: ["windsurf"],
		"claude code": ["claude-code"],
		"vscode copilot": ["vscode"],
	};
	return map[tool.toLowerCase()] || all;
}

export async function init(targetPath?: string, options?: { yes?: boolean; serve?: boolean }) {
	const root = resolve(process.cwd(), targetPath || ".");
	const letraDir = join(root, ".letra");

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
		let tool = "cursor";

		if (options?.yes || !process.stdin.isTTY) {
			projectType = "web-app";
			tool = "todos";
		} else {
			spinner.stop();

			projectType = await ask("Project type?", ["web-app", "cli", "library", "mobile"]);
			const toolNames = [
				"Cursor",
				"Windsurf",
				"Claude Code",
				"VSCode Copilot",
				"OpenCode",
				"Todos",
			];
			const answer = await ask("AI coding agent?", toolNames);
			tool = answer.toLowerCase();

			spinner.start();
		}

		mkdirSync(join(letraDir, "decisions"), { recursive: true });
		mkdirSync(join(letraDir, "specs", "_template"), { recursive: true });
		mkdirSync(join(letraDir, "adapters"), { recursive: true });

		// Walk up from src/commands/ to find project root .letra/
		const templateFiles: Record<string, string> = {
			"context.md": `# Context

> Updated: 2026-05-01
> Owner: letra-dev

## Intent

Letra é um framework de Specification-Driven Development (SDD) agnóstico a ferramentas.
Captura direção, intenção e contexto, enriquecendo prompts de agentes de código.

## Domínio

- **Produto**: CLI + adapters + formato de memória .letra/
- **Público**: 1. Não-devs

## Restrições Reais

- Specs devem ser thin (máx 1 página por feature)
- Sem lock-in de IDE
- Drift detection deve funcionar para qualquer domínio (não só código)

## Porquês

- Escolhemos TypeScript porque 82% dos novos pacotes npm são TS em 2026
- Escolhemos Markdown checklist porque não-devs precisam ler e escrever specs
`,
			"constitution.md": `# Constitution

## Arquitetura
- Adapter layer desde o dia 1 — nunca travar em uma IDE
- Formato .letra/ é a fonte da verdade, não o código
- CLI deve ser extensível via plugins

## Código
- TypeScript estrito (strict: true)
- Zero dependencies desnecessárias

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
- TypeScript domina CLIs em 2026 (82% dos novos pacotes npm)

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

		const tools = adaptersForTool(tool);
		generateAdapters(root, tools, { source: "init", verb: "Created" });

		if (tool === "todos" || tool === "vscode") {
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
