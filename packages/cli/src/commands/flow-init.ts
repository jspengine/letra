import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import chalk from "chalk";
import ora from "ora";
import { generateAdapters } from "../adapters/generate.js";
import { generateHermesAdapter } from "../adapters/hermes.js";
import { logEntry } from "../session-log.js";
import { DiagnosticEngine } from "../diagnostics/engine.js";
import { loadHealthRecord, mergeScanResults, saveHealthRecord } from "../health-record.js";
import { loadHarness, resolveHarnessRoot } from "../harness/loader.js";

export interface Stage {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	stageId?: string;
	allow?: string[];
	validate?: string[];
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
	claimedBy?: string;
	claimedAt?: string;
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
	language?: string;
	specLinks?: Record<string, SpecLink>;
	createdAt: string;
	updatedAt: string;
	stages: Stage[];
	items: Item[];
	tools: string[];
	webhooks?: WebhookConfig[];
	primaryItemId?: string;
	state?: {
		currentStage?: string;
		locked?: boolean;
	};
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
	if (existsSync(join(root, ".hermes", "instructions.md"))) tools.push("hermes");
	if (existsSync(join(root, ".cursorrules"))) tools.push("cursor");
	if (existsSync(join(root, "CLAUDE.md"))) tools.push("claude-code");
	if (existsSync(join(root, ".windsurfrules"))) tools.push("windsurf");
	if (existsSync(join(root, "AGENTS.md"))) tools.push("opencode");
	if (existsSync(join(root, ".github", "copilot-instructions.md"))) tools.push("vscode");
	return tools;
}

export function detectProjectName(root: string): string {
	const pkgPath = join(root, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.name) return pkg.name.replace(/^@[^/]+/, "");
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

export type WriteWorkflowSource =
	| "flow-move"
	| "flow-backlog"
	| "flow-edit"
	| "flow-import"
	| "flow-init"
	| "flow-ac"
	| "flow-claim"
	| "flow-release"
	| "init"
	| "stage-drift"
	| "web-ui"
	| "focus";

export interface WriteWorkflowOptions {
	workflow: Workflow;
	source: WriteWorkflowSource;
	primaryItemId?: string;
	skipAdapters?: boolean;
	skipSitrep?: boolean;
	skipLog?: boolean;
	skipEngine?: boolean;
	quiet?: boolean;
}

export interface WriteWorkflowResult {
	ok: boolean;
	filesUpdated: string[];
	error?: string;
}

const ADAPTER_TARGETS: Record<string, string> = {
	cursor: ".cursorrules",
	opencode: "AGENTS.md",
	vscode: ".github/copilot-instructions.md",
	"claude-code": "CLAUDE.md",
	windsurf: ".windsurfrules",
	hermes: ".hermes/instructions.md",
};

export async function writeWorkflow(root: string, options: WriteWorkflowOptions): Promise<WriteWorkflowResult> {
	const { workflow, source, primaryItemId, skipAdapters, skipSitrep, skipLog, skipEngine, quiet } = options;

	if (!workflow.items || !Array.isArray(workflow.items)) {
		return { ok: false, filesUpdated: [], error: "workflow.items must be an array" };
	}
	if (!workflow.stages || !Array.isArray(workflow.stages)) {
		return { ok: false, filesUpdated: [], error: "workflow.stages must be an array" };
	}

	const filesUpdated: string[] = [];
	let graveIssueCount = 0;

	// 1. Persist workflow.json
	saveWorkflow(root, workflow);
	filesUpdated.push(".letra/workflow.json");

	// 2. Run engine diagnostics (AC9)
	if (!skipEngine) {
		try {
			const engine = new DiagnosticEngine(root);
			const diagOutput = await engine.runAll();
			const rawResults = engine.getLastResults();
			const healthRecord = loadHealthRecord(root);
			mergeScanResults(healthRecord, rawResults);
			saveHealthRecord(root, healthRecord);
			graveIssueCount = diagOutput.suggestions.filter((s) => s.type === "error").length;
			if (diagOutput.errors.length > 0) {
				graveIssueCount += diagOutput.errors.length;
			}
			if (!quiet) {
				const totalIssues = diagOutput.fixes.length + diagOutput.suggestions.length;
				if (totalIssues > 0) {
					console.log(chalk.gray(`  Diagnóstico: ${totalIssues} issue(s), ${diagOutput.fixes.length} auto-corrigido(s)`));
				}
			}
		} catch (e) {
			if (!quiet) {
				console.log(chalk.yellow(`  Diagnóstico ignorado: ${e}`));
			}
		}
	}

	// 3. Regenerate adapters (AC9.5: pass grave issue count for top warning)
	if (!skipAdapters && workflow.tools && workflow.tools.length > 0) {
		const activeStage = primaryItemId
			? workflow.items.find((i) => i.id === primaryItemId)?.stage
			: workflow.items[0]?.stage;
		generateAdapters(root, workflow.tools, {
			source: "flow-move",
			workflow: {
				name: workflow.name,
				stages: workflow.stages,
				items: workflow.items,
			},
			activeStageId: activeStage || workflow.stages[0]?.id || "backlog",
			primaryItemId: primaryItemId || workflow.items[0]?.id,
			graveIssueCount: graveIssueCount > 0 ? graveIssueCount : undefined,
		});

		// Hermes-specific writing when selected
		if (workflow.tools.includes("hermes")) {
			const hermesContent = generateHermesAdapter(root);
			if (hermesContent) {
				const hermesPath = join(root, ".hermes", "instructions.md");
				const hermesDir = join(hermesPath, "..");
				if (!existsSync(hermesDir)) mkdirSync(hermesDir, { recursive: true });
				writeFileSync(hermesPath, hermesContent, "utf-8");
				filesUpdated.push(".hermes/instructions.md");
			}
		}

		for (const tool of workflow.tools) {
			const target = ADAPTER_TARGETS[tool];
			if (target) filesUpdated.push(target);
		}
	}

	// 4. Sitrep — skipped by default (expensive)
	if (!skipSitrep) {
		try {
			const { sitrep } = await import("./sitrep.js");
			await sitrep(root, { quiet: true, skipLog: true });
		} catch {}
	}

	// 5. Log
	if (!skipLog) {
		try {
			logEntry(root, "system", `workflow_updated via ${source}` as const);
		} catch {}
	}

	return { ok: true, filesUpdated };
}

export async function flowInit(root: string, options?: { quick?: boolean }): Promise<Workflow> {
	if (!process.stdin.isTTY && !options?.quick) {
		console.log(chalk.yellow("Non-TTY: usando defaults. Passe --quick para confirmar."));
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
	const defaultTools = detected.length > 0 ? detected.join(", ") : "hermes, opencode";
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
	const harness = loadHarness(resolveHarnessRoot(root));
	const sdlcStages = harness?.flows?.sdlc?.stages;
	const defaultStagesList = sdlcStages && sdlcStages.length > 0
		? sdlcStages.map((s) => s.name).join(", ")
		: "backlog, design, code, review, done";
	const detected = detectExistingTools(root);
	const defaultTools = detected.length > 0 ? detected.join(", ") : "hermes, opencode";

	const name = await askText("Workflow name?", defaultName);
	const stagesInput = await askText("Stages (comma-separated)?", defaultStagesList);
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
		console.log(chalk.yellow("Workflow already exists at .letra/workflow.json"));
		return;
	}

	const spinner = ora("Setting up workflow...").start();

	try {
		spinner.stop();
		const workflow = await flowInit(root, options);
		spinner.start();

		writeWorkflow(root, { workflow, source: "flow-init", skipSitrep: true });

		spinner.succeed(chalk.green("Workflow created at .letra/workflow.json"));
		console.log("");
		console.log(`  Name:   ${chalk.cyan(workflow.name)}`);
		console.log(`  Stages: ${chalk.cyan(workflow.stages.map((s) => s.name).join(" → "))}`);
		console.log(`  Tools:  ${chalk.cyan(workflow.tools.join(", "))}`);
		console.log("");
		console.log("  Next steps:");
		console.log(
			`    ${chalk.cyan("letra flow backlog add <desc>")}   Add items to your backlog`,
		);
		console.log(`    ${chalk.cyan("letra flow board")}                View your board`);
	} catch (error) {
		spinner.fail(chalk.red("Failed to create workflow"));
		process.exit(1);
	}
}
