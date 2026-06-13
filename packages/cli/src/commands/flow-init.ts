import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import chalk from "chalk";
import ora from "ora";

export interface Stage {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	/** Stage IDs allowed as transition targets. Empty array = no transitions allowed. Omitted = all allowed. */
	allow?: string[];
	/** Validation checklist items that must be completed before moving an item out of this stage. */
	validate?: string[];
	/** Accent color for the stage column header, border, and cards. */
	color?: string;
}

export interface Task {
	id: string;
	description: string;
	done: boolean;
}

export interface Item {
	id: string;
	description: string;
	stage: string;
	createdAt: string;
	source?: "github" | "linear";
	sourceUrl?: string;
	spec?: string;
	tasks?: Task[];
}

export interface SpecLink {
	path: string;
	aliases?: string[];
}

export interface WebhookConfig {
	id: string;
	url: string;
	events: string[];
	label?: string;
	lastStatus?: "ok" | "error";
	lastSentAt?: string;
}

export interface Workflow {
	version: string;
	name: string;
	description?: string;
	specLinks?: Record<string, SpecLink>;
	createdAt: string;
	updatedAt: string;
	stages: Stage[];
	items: Item[];
	tools: string[];
	webhooks?: WebhookConfig[];
}

function askText(query: string, defaultValue: string): Promise<string> {
	if (!process.stdin.isTTY) return Promise.resolve(defaultValue);
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		const formatted = `${chalk.cyan(query)} ${chalk.gray(`(default: ${defaultValue})`)}\n> `;
		rl.question(formatted, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultValue);
		});
	});
}

export function detectExistingTools(root: string): string[] {
	const tools: string[] = [];
	if (existsSync(join(root, ".cursorrules"))) tools.push("cursor");
	if (existsSync(join(root, "CLAUDE.md"))) tools.push("claude-code");
	if (existsSync(join(root, ".windsurfrules"))) tools.push("windsurf");
	if (existsSync(join(root, "AGENTS.md"))) tools.push("opencode");
	if (existsSync(join(root, ".github", "copilot-instructions.md")))
		tools.push("vscode");
	return tools;
}

export function detectProjectName(root: string): string {
	const pkgPath = join(root, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.name) return pkg.name.replace(/^@[^/]+\//, "");
		} catch {}
	}
	return resolve(root).split(/[\\/]/).pop() || "meu-projeto";
}

export function stagesFromInput(input: string): Stage[] {
	return input
		.split(",")
		.map((s, i) => {
			const trimmed = s.trim();
			if (!trimmed) return null;
			return {
				id: trimmed
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, ""),
				name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
				order: i,
			};
		})
		.filter((s): s is Stage => s !== null);
}

function now(): string {
	return new Date().toISOString();
}

function workflowFilePath(root: string): string {
	return join(root, ".letra", "workflow.json");
}

export function loadWorkflow(root: string): Workflow | null {
	const filePath = workflowFilePath(root);
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8")) as Workflow;
	} catch {
		return null;
	}
}

export function saveWorkflow(root: string, workflow: Workflow): void {
	const dir = join(root, ".letra");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const filePath = workflowFilePath(root);
	// Backup existing workflow before overwriting
	if (existsSync(filePath)) {
		const backupDir = join(root, ".letra", "backups");
		if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
		const ts = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = join(backupDir, `workflow-${ts}.json`);
		try {
			const existing = readFileSync(filePath, "utf-8");
			writeFileSync(backupPath, existing, "utf-8");
		} catch {
			// best-effort backup
		}
	}
	writeFileSync(filePath, JSON.stringify(workflow, null, 2));
}

export async function flowInit(
	root: string,
	options?: { quick?: boolean },
): Promise<Workflow> {
	if (!process.stdin.isTTY && !options?.quick) {
		console.log(
			chalk.yellow("Non-TTY: usando defaults. Passe --quick para confirmar."),
		);
		return flowInitQuick(root);
	}

	if (options?.quick) {
		return flowInitQuick(root);
	}

	const name = await askText("Workflow name?", detectProjectName(root));
	const stagesInput = await askText(
		"Stages (comma-separated)?",
		"backlog, design, code, review, done",
	);
	const stages = stagesFromInput(stagesInput);

	const detected = detectExistingTools(root);
	const defaultTools =
		detected.length > 0 ? detected.join(", ") : "cursor, opencode";
	const toolsInput = await askText("Tools (comma-separated)?", defaultTools);
	const tools = toolsInput
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	const workflow: Workflow = {
		version: "1.0",
		name,
		createdAt: now(),
		updatedAt: now(),
		stages,
		items: [],
		tools,
	};

	return workflow;
}

async function flowInitQuick(root: string): Promise<Workflow> {
	const defaultName = detectProjectName(root);
	const defaultStagesList = "backlog, design, code, review, done";
	const detected = detectExistingTools(root);
	const defaultTools =
		detected.length > 0 ? detected.join(", ") : "cursor, opencode";

	const name = await askText("Workflow name?", defaultName);
	const stagesInput = await askText(
		"Stages (comma-separated)?",
		defaultStagesList,
	);
	const stages = stagesFromInput(stagesInput);

	const toolsInput = await askText("Tools (comma-separated)?", defaultTools);
	const tools = toolsInput
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	const workflow: Workflow = {
		version: "1.0",
		name,
		createdAt: now(),
		updatedAt: now(),
		stages,
		items: [],
		tools,
	};

	return workflow;
}

export async function flowInitAction(
	targetPath: string | undefined,
	options?: { quick?: boolean },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	const filePath = workflowFilePath(root);

	if (existsSync(filePath)) {
		console.log(
			chalk.yellow("Workflow already exists at .letra/workflow.json"),
		);
		return;
	}

	const spinner = ora("Setting up workflow...").start();

	try {
		spinner.stop();
		const workflow = await flowInit(root, options);
		spinner.start();

		saveWorkflow(root, workflow);

		spinner.succeed(chalk.green("Workflow created at .letra/workflow.json"));
		console.log("");
		console.log(`  Name:   ${chalk.cyan(workflow.name)}`);
		console.log(
			`  Stages: ${chalk.cyan(workflow.stages.map((s) => s.name).join(" → "))}`,
		);
		console.log(`  Tools:  ${chalk.cyan(workflow.tools.join(", "))}`);
		console.log("");
		console.log("  Next steps:");
		console.log(
			`    ${chalk.cyan("letra flow backlog add <desc>")}   Add items to your backlog`,
		);
		console.log(
			`    ${chalk.cyan("letra flow board")}                View your board`,
		);
	} catch (error) {
		spinner.fail(chalk.red("Failed to create workflow"));
		process.exit(1);
	}
}
