import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { searchInSource, walkDir } from "../shared/file-search.js";

const DONE_AC_PATTERN = /-\s\[x\]\s\*\*`([^`]+)`\*\*/g;
const ACTIVE_STAGES = new Set(["code", "review", "done"]);

export const specCodeDriftDetector: Detector = {
	name: "spec-code-drift",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const workflowPath = join(rootDir, ".letra", "workflow.json");
		const specsDir = join(rootDir, ".letra", "specs");

		if (!existsSync(workflowPath) || !existsSync(specsDir)) return results;

		const specStages = loadSpecStages(workflowPath);
		const specDirs = readdirSync(specsDir, { withFileTypes: true }).filter(
			(d) => d.isDirectory() && !d.name.startsWith("_"),
		);

		for (const dir of specDirs) {
			const stage = specStages.get(dir.name);
			if (!stage || !ACTIVE_STAGES.has(stage)) continue;

			const specFile = join(specsDir, dir.name, "spec.md");
			if (!existsSync(specFile)) continue;

			const content = readFileSync(specFile, "utf-8");
			const matches = [...content.matchAll(DONE_AC_PATTERN)];

			for (const match of matches) {
				const command = match[1].trim();
				if (!command) continue;

				const commandWords = command.split(/\s+/);
				const camelCaseName = commandWords
					.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
					.join("");
				const pascalCaseName = commandWords
					.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
					.join("");

				const foundInSource = searchInSource(rootDir, [
					command,
					camelCaseName,
					pascalCaseName,
				]);

				if (!foundInSource) {
					results.push({
						id: `spec-code-drift_${dir.name}_${command.replace(/\s+/g, "-")}`,
						type: "warning",
						title: `AC "${command}" do spec ${dir.name} não encontrado no código`,
						description: `O AC "${command}" está marcado como [x] em ${dir.name}, mas o código-fonte atual não contém implementação correspondente. Pode ter sido removido ou renomeado.`,
						certainty: 0.7,
						detector: "spec-code-drift",
					});
				}
			}
		}

		return results;
	},
};

function loadSpecStages(workflowPath: string): Map<string, string> {
	const map = new Map<string, string>();
	try {
		const raw = readFileSync(workflowPath, "utf-8");
		const wf = JSON.parse(raw);
		if (!wf.items || !Array.isArray(wf.items)) return map;
		for (const item of wf.items) {
			if (item.spec && item.stage) {
				map.set(item.spec, item.stage);
			}
		}
	} catch {}
	return map;
}


