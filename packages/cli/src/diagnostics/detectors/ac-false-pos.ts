import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { searchInSource } from "../shared/file-search.js";
import { getLetraDir } from "./../../workspace/resolver.js";

const DONE_AC_PATTERN = /-\s\[x\]\s\*\*`([^`]+)`\*\*/g;

function toCamelCase(words: string[]): string {
	return words
		.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
		.join("");
}

function toPascalCase(words: string[]): string {
	return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function toKebabCase(words: string[]): string {
	return words.join("-");
}

function toSnakeCase(words: string[]): string {
	return words.join("_");
}

function extractSearchTerms(command: string): string[] {
	const words = command.split(/\s+/);
	const terms: string[] = [command];

	if (words.length > 1) {
		terms.push(toCamelCase(words));
		terms.push(toPascalCase(words));
		terms.push(toKebabCase(words));
		terms.push(toSnakeCase(words));
	}

	const baseCommand = words[0];
	if (baseCommand) {
		terms.push(baseCommand);
		const baseWords = baseCommand.split(/[\s-_]+/);
		if (baseWords.length > 1) {
			terms.push(toCamelCase(baseWords));
			terms.push(toKebabCase(baseWords));
		}
	}

	const nonFlagWords = words.filter((w) => !w.startsWith("-"));
	if (nonFlagWords.length < words.length && nonFlagWords.length > 0) {
		terms.push(nonFlagWords.join(" "));
		if (nonFlagWords.length > 1) {
			terms.push(toCamelCase(nonFlagWords));
			terms.push(toKebabCase(nonFlagWords));
		}
	}

	if (nonFlagWords.length > 1) {
		const subCommandWords = nonFlagWords.slice(1);
		for (const word of subCommandWords) {
			if (word.length >= 2) {
				terms.push(word);
			}
		}
		if (subCommandWords.length > 1) {
			terms.push(toCamelCase(subCommandWords));
			terms.push(toKebabCase(subCommandWords));
			terms.push(toSnakeCase(subCommandWords));
		}
	}

	return [...new Set(terms)].filter((t) => t.length > 1);
}

function isApiEndpoint(command: string): boolean {
	return /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i.test(command);
}

function extractApiPath(command: string): string[] {
	const match = command.match(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
	if (!match) return [];
	const path = match[1].trim();
	const terms: string[] = [path];
	if (path !== "/") {
		const parts = path.split("/").filter(Boolean);
		terms.push(...parts);
	}
	return [...new Set(terms)].filter((t) => t.length > 1);
}

export const acFalsePosDetector: Detector = {
	name: "ac-false-pos",
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
			const matches = [...content.matchAll(DONE_AC_PATTERN)];

			for (const match of matches) {
				const command = match[1].trim();
				if (!command) continue;

				let searchTerms: string[];
				if (isApiEndpoint(command)) {
					searchTerms = extractApiPath(command);
					if (searchTerms.length === 0) continue;
				} else {
					searchTerms = extractSearchTerms(command);
				}

				const foundInSource = searchInSource(rootDir, searchTerms);

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
