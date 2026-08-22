import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import type { Detector, DiagnosticResult } from "../types.js";
import { searchInSource, escapeRegex } from "../shared/file-search.js";
import { getLetraDir } from "./../../workspace/resolver.js";

const STALE_AC_PATTERN = /-\s\[ \]\s\*\*`([^`]+)`\*\*/g;

function toCamelCase(words: string[]): string {
	return words
		.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
		.join("");
}

function toPascalCase(words: string[]): string {
	return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

export const acStaleDetector: Detector = {
	name: "ac-stale",
	devOnly: true,
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const specsDir = join(getLetraDir(rootDir), "specs");

		if (!existsSync(specsDir)) return results;

		const specDirs = readdirSync(specsDir, { withFileTypes: true }).filter(
			(d) => d.isDirectory() && !d.name.startsWith("_"),
		);

		for (const dir of specDirs) {
			const specFile = join(specsDir, dir.name, "spec.md");
			if (!existsSync(specFile)) continue;

			const content = readFileSync(specFile, "utf-8");
			const matches = content.matchAll(STALE_AC_PATTERN);

			for (const match of matches) {
				const command = match[1].trim();
				if (!command) continue;

				const commandWords = command.split(/\s+/);
				const camelCaseName = toCamelCase(commandWords);
				const pascalCaseName = toPascalCase(commandWords);

				const foundInSource = searchInSource(rootDir, [
					command,
					camelCaseName,
					pascalCaseName,
				]);

				if (foundInSource) {
					results.push({
						id: `ac-stale_${dir.name}_${command.replace(/\s+/g, "-")}`,
						type: "info",
						title: `AC "${command}" marcado [ ] mas implementado`,
						description: `O acceptance criteria "${command}" do spec ${dir.name} está marcado como não feito ([ ]), mas o código-fonte contém implementação correspondente.`,
						certainty: 0.9,
						detector: "ac-stale",
						autoFix: async () => {
							const newContent = content.replace(
								new RegExp(
									`(- \\[ \\] \\*\\*\`)(${escapeRegex(command)}(\\s[^*]+)?\\*\\*)`,
								),
								(m) => m.replace("[ ]", "[x]"),
							);
							const before = readFileSync(specFile, "utf-8");
							return {
								files: [
									{
										path: `.letra/specs/${dir.name}/spec.md`,
										before,
										after: newContent,
									},
								],
								snapshotId: "",
							};
						},
					});
				}
			}
		}

		return results;
	},
};


