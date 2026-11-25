import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Workflow } from "../commands/flow-init.js";

export type ExecutionWorkspaceResolution =
	| { ok: true; root: string }
	| { ok: false; reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE" | "EXECUTION_WORKSPACE_UNTRUSTED"; reason: string };

function samePath(left: string, right: string): boolean {
	return resolve(left).replace(/\\/g, "/").toLowerCase() === resolve(right).replace(/\\/g, "/").toLowerCase();
}

/**
 * Resolves the source tree that an external executor may modify. The harness
 * data directory is deliberately never considered a source tree merely
 * because it contains workflow.json.
 */
export function resolveExecutionWorkspace(input: {
	workflow: Workflow;
	workspaceRoot: string;
	selectedDirectory?: string | null;
}): ExecutionWorkspaceResolution {
	const locations = input.workflow.locations ?? [];
	let candidate: string | undefined;
	if (input.selectedDirectory) {
		candidate = locations.find((location) => samePath(location.path, input.selectedDirectory!))?.path;
		if (!candidate) {
			return {
				ok: false,
				reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE",
				reason: "O diretório selecionado não é uma localização canônica deste workspace. Selecione uma pasta registrada no fluxo.",
			};
		}
	} else if (locations.length === 1) {
		candidate = locations[0].path;
	} else if (locations.length > 1) {
		return {
			ok: false,
			reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE",
			reason: "O workspace possui mais de uma localização. Selecione a pasta de código que deve receber a execução.",
		};
	} else {
		candidate = input.workspaceRoot;
	}

	const absolute = resolve(candidate);
	if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
		return { ok: false, reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE", reason: `A localização configurada não existe ou não é uma pasta: ${absolute}` };
	}
	try {
		const root = realpathSync(absolute);
		const gitRoot = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		if (!gitRoot) throw new Error("Git não retornou a raiz do repositório.");
		return { ok: true, root: realpathSync(gitRoot) };
	} catch {
		return {
			ok: false,
			reasonCode: "EXECUTION_WORKSPACE_UNTRUSTED",
			reason: `A localização configurada não é um repositório Git confiável para o executor: ${absolute}. Configure o repositório como seguro e tente novamente.`,
		};
	}
}
