import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";

const ADAPTER_FILES: Record<string, { path: string; format: "at" | "text" }> = {
	cursor: { path: ".cursorrules", format: "at" },
	"claude-code": { path: "CLAUDE.md", format: "text" },
	windsurf: { path: ".windsurfrules", format: "at" },
	vscode: { path: ".github/copilot-instructions.md", format: "text" },
	opencode: { path: "AGENTS.md", format: "text" },
};

export const harnessStaleDetector: Detector = {
	name: "harness-stale",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const workflowFile = join(rootDir, ".letra", "workflow.json");

		let tools: string[] = ["cursor", "opencode", "vscode"]; // defaults
		if (existsSync(workflowFile)) {
			try {
				const wf = JSON.parse(readFileSync(workflowFile, "utf-8"));
				if (Array.isArray(wf.tools)) {
					tools = wf.tools;
				}
			} catch {}
		}

		for (const tool of tools) {
			const info = ADAPTER_FILES[tool];
			if (!info) continue;

			const filePath = join(rootDir, info.path);
			if (!existsSync(filePath)) continue;

			const content = readFileSync(filePath, "utf-8");
			let isStale = false;

			if (info.format === "at") {
				if (
					!content.includes("@.letra/context.md") ||
					!content.includes("@.letra/constitution.md")
				) {
					isStale = true;
				}
			} else {
				if (
					!content.includes(".letra/context.md") ||
					!content.includes(".letra/constitution.md")
				) {
					isStale = true;
				}
			}

			if (isStale) {
				results.push({
					id: `harness-stale_${tool}`,
					type: "warning",
					title: `Adapter desatualizado: ${tool}`,
					description: `O adaptador ${info.path} do ${tool} existe mas está sem as referências de contexto globais (L1). Execute 'letra flow move' ou 'letra focus' para regenerá-lo.`,
					certainty: 0.85,
					detector: "harness-stale",
				});
			}
		}

		return results;
	},
};
