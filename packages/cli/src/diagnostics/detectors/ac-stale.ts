import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import type { Detector, DiagnosticResult } from "../types.js";

const STALE_AC_PATTERN = /-\s\[ \]\s\*\*`([^`]+)`\*\*/g;

export const acStaleDetector: Detector = {
	name: "ac-stale",
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
			const matches = content.matchAll(STALE_AC_PATTERN);

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

function searchInSource(rootDir: string, terms: string[]): boolean {
	const searchDirs = ["packages/cli/src", "packages/client/src", "packages/ui/src"];
	for (const searchDir of searchDirs) {
		const dir = join(rootDir, searchDir);
		if (!existsSync(dir)) continue;
		try {
			const files = walkDir(dir);
			for (const file of files) {
				const content = readFileSync(file, "utf-8");
				for (const term of terms) {
					if (content.includes(term)) return true;
				}
			}
		} catch {}
	}
	return false;
}

function walkDir(dir: string): string[] {
	const files: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory() && entry.name !== "node_modules") {
				files.push(...walkDir(fullPath));
			} else if (
				entry.isFile() &&
				(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
			) {
				files.push(fullPath);
			}
		}
	} catch {
		/* skip unreadable */
	}
	return files;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
