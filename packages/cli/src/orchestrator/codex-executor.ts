import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RichAgenticExecutor } from "../executor/executor.js";
import type { ExecutionContext, ExecutionResult } from "../harness/types.js";

interface CodexExecutorOptions {
	root: string;
	capabilities: string[];
	command?: string;
	model?: string;
	timeoutMs?: number;
}

function nextHandoff(context: ExecutionContext, executorId: string, evidence: string[]) {
	const stages = Array.isArray((context.snapshot as { stages?: unknown[] })?.stages)
		? ((context.snapshot as { stages: Array<{ id: string; order: number; agents?: string[] }> }).stages)
		: [];
	const current = stages.find((stage) => stage.id === context.stage);
	const next = current
		? stages.filter((stage) => stage.order > current.order).sort((a, b) => a.order - b.order)[0]
		: undefined;
	const target = next?.agents?.[0] ?? "human";
	const timestamp = new Date().toISOString();
	return {
		type: "handoff" as const,
		itemId: context.itemId,
		from: executorId,
		to: target,
		summary: `Codex concluiu ${context.stage}; aguardando ${target}.`,
		evidence,
		timestamp,
	};
}

function parseCodexOutput(stdout: string): { output: string; evidences: string[] } {
	const messages: string[] = [];
	for (const line of stdout.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const event = JSON.parse(trimmed) as {
				type?: string;
				item?: { type?: string; text?: string };
				text?: string;
			};
			const text = event.item?.text ?? event.text;
			if (text && (event.item?.type === "agent_message" || event.type === "agent_message" || event.type === "turn.completed")) messages.push(text);
		} catch {
			// Codex may emit human-readable diagnostics alongside JSON events.
		}
	}
	return { output: messages.join("\n\n").trim() || stdout.trim(), evidences: [] };
}

function collectWorkspaceEvidence(root: string): string[] {
	try {
		const files = execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" })
			.split(/\r?\n/)
			.map((file) => file.trim())
			.filter(Boolean);
		const untracked = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" })
			.split(/\r?\n/)
			.map((line) => line.slice(3).trim())
			.filter(Boolean);
		return [...new Set([...files, ...untracked])];
	} catch {
		return [];
	}
}

function runCodex(root: string, command: string, model: string, prompt: string, timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		// `-C` is a global Codex option. Put it before the `exec` subcommand as
		// well as setting spawn.cwd: older Codex CLIs ignore global options after
		// a subcommand and then report that they are outside a trusted directory.
		// The Letra preflight has already resolved and verified `root` as the
		// selected Git repository. Pass that proof to Codex so its own trust
		// guard does not reject a valid external workspace before execution.
		const baseArgs = ["-C", root, "exec", "--skip-git-repo-check", "--json", "--ephemeral", "--model", model, "--sandbox", "workspace-write", "-"];
		const npmCodex = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
		const useNodeEntrypoint = process.platform === "win32" && command === "codex" && existsSync(npmCodex);
		const executable = useNodeEntrypoint ? process.execPath : (process.platform === "win32" && command === "codex" ? "codex.cmd" : command);
		const args = useNodeEntrypoint ? [npmCodex, ...baseArgs] : baseArgs;
		const child = spawn(executable, args, {
			cwd: root,
			stdio: ["pipe", "pipe", "pipe"],
			shell: !useNodeEntrypoint && process.platform === "win32",
			windowsHide: true,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (result: { code: number; stdout: string; stderr: string }) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};
		const timer = setTimeout(() => {
			if (settled) return;
			child.kill();
			finish({ code: 124, stdout, stderr: `${stderr}\nCodex executor timed out after ${timeoutMs}ms.`.trim() });
		}, timeoutMs);
		child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
		child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
		child.on("error", (error) => {
			clearTimeout(timer);
			if (!settled) reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			finish({ code: code ?? 1, stdout, stderr });
		});
		child.stdin.end(prompt);
	});
}

export function createCodexExecutor(options: CodexExecutorOptions): RichAgenticExecutor {
	const id = "codex";
	const command = options.command ?? "codex";
	const model = options.model ?? "gpt-5.5";
	const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
	const available = command === "codex" || existsSync(command);
	return {
		id,
		label: "Codex CLI",
		capabilities: options.capabilities,
		status: available ? "online" : "offline",
		heartbeat: async () => undefined,
	async execute(context: ExecutionContext): Promise<ExecutionResult> {
			const executionRoot = typeof (context.snapshot as { executionWorkspace?: unknown }).executionWorkspace === "string"
				? (context.snapshot as { executionWorkspace: string }).executionWorkspace
				: options.root;
			const persona = (context.snapshot as { persona?: { displayName?: string; role?: string; skills?: Array<{ label: string; level: string }>; adapterHints?: Record<string, string>; stageBindings?: string[] } }).persona;
			const personaContext = persona
				? [
					`Persona: ${persona.displayName ?? context.agent}`,
					`Papel: ${persona.role ?? "não informado"}`,
					`Skills relevantes: ${(persona.skills ?? []).map((skill) => `${skill.label} (${skill.level})`).join(", ") || "nenhuma"}`,
					`Estágios permitidos: ${(persona.stageBindings ?? []).join(", ") || "nenhum"}`,
					`Restrições da persona: ${Object.values(persona.adapterHints ?? {}).join("; ") || "seguir o harness"}`,
				].join("\n")
				: `Persona/actor: ${context.agent}`;
			const prompt = [
				"Você é o executor externo Codex operando sob o protocolo do Letra.",
				`Item: ${context.itemId}`,
				`Estágio: ${context.stage}`,
				personaContext,
				`Spec: ${context.spec ?? "nenhuma"}`,
				context.promptTemplate ? `Template do papel: ${context.promptTemplate}` : "",
				"Leia a direção vigente com 'letra direction --json' antes de agir.",
				"Implemente o trabalho real do estágio no workspace atual, respeitando a spec, a constituição e os ACs.",
				"Você pode editar arquivos do projeto e executar testes. Não edite .letra/workflow.json manualmente, não altere o harness e não aprove gates humanos.",
				"Ao terminar, deixe os arquivos e testes reais prontos e responda com um resumo objetivo.",
			].join("\n");
			try {
				const result = await runCodex(executionRoot, command, model, prompt, timeoutMs);
				const parsed = parseCodexOutput(result.stdout);
				if (result.code !== 0) return { success: false, output: parsed.output, artifacts: [], evidences: [], error: result.stderr || parsed.output || `Codex terminou com código ${result.code}.` };
				const evidence = collectWorkspaceEvidence(executionRoot);
				return { success: true, output: parsed.output, artifacts: [], evidences: evidence, handoff: nextHandoff(context, id, evidence) };
			} catch (error) {
				return { success: false, output: "", artifacts: [], evidences: [], error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
