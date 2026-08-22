import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { getLetraDir } from "./../../workspace/resolver.js";

export const focusStaleDetector: Detector = {
	name: "focus-stale",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const focusFile = join(getLetraDir(rootDir), "focus.md");
		if (!existsSync(focusFile)) return results;

		const focusContent = readFileSync(focusFile, "utf-8");
		const firstLine = focusContent.split("\n")[0]?.trim() ?? "";
		const specMatch = firstLine.match(/^#\s*Focus:\s*(.+)$/i);
		if (!specMatch) return results;

		const focusSpec = specMatch[1].trim();
		const specDir = join(getLetraDir(rootDir), "specs", focusSpec);
		if (!existsSync(specDir)) {
			results.push({
				id: `focus-stale_missing-dir_${focusSpec}`,
				type: "warning",
				title: `focusSpec "${focusSpec}" não encontrada em disco`,
				description: `focus.md referencia a spec "${focusSpec}" mas o diretório .letra/specs/${focusSpec}/ não existe. Use 'letra focus --clear' para limpar o foco.`,
				certainty: 1.0,
				detector: "focus-stale",
			});
			return results;
		}

		const workflowFile = join(getLetraDir(rootDir), "workflow.json");
		if (!existsSync(workflowFile)) return results;

		const workflow = JSON.parse(readFileSync(workflowFile, "utf-8"));
		const specLinks = workflow.specLinks || {};

		if (!specLinks[focusSpec]) {
			results.push({
				id: `focus-stale_unregistered_${focusSpec}`,
				type: "info",
				title: `focusSpec "${focusSpec}" não registrada em specLinks`,
				description: `focus.md referencia a spec "${focusSpec}" mas specLinks não contém entrada para ela.`,
				certainty: 0.7,
				detector: "focus-stale",
			});
		}

		return results;
	},
};
