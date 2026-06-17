import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { searchInSource } from "../shared/file-search.js";

const DONE_AC_PATTERN = /-\s\[x\]\s\*\*`([^`]+)`\*\*/g;

export const acFalsePosDetector: Detector = {
	name: "ac-false-pos",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const specsDir = join(rootDir, ".letra", "specs");

		if (!existsSync(specsDir)) return results;

		const specDirs = readdirSync(specsDir, { withFileTypes: true }).filter(
			(d) => d.isDirectory() && !d.name.startsWith("_"),
		);

		for (const dir of specDirs) {
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
						id: `ac-false-pos_${dir.name}_${command.replace(/\s+/g, "-")}`,
						type: "warning",
						title: `AC "${command}" marcado [x] mas não encontrado no código`,
						description: `O acceptance criteria "${command}" do spec ${dir.name} está marcado como feito ([x]), mas o código-fonte não contém implementação correspondente. Pode ser um falso positivo.`,
						certainty: 0.7,
						detector: "ac-false-pos",
					});
				}
			}
		}

		return results;
	},
};
