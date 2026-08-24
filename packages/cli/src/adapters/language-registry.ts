import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface LangConfig {
	name: string;
	detect: string[];
}

export const LANGUAGE_REGISTRY: LangConfig[] = [
	{ name: "Node.js", detect: ["package.json"] },
	{ name: "Python", detect: ["pyproject.toml", "setup.py", "requirements.txt"] },
	{ name: "C# (.NET)", detect: ["*.csproj", "*.sln"] },
	{ name: "Java", detect: ["pom.xml", "build.gradle"] },
	{ name: "Go", detect: ["go.mod"] },
	{ name: "Rust", detect: ["Cargo.toml"] },
	{ name: "PHP", detect: ["composer.json"] },
	{ name: "Ruby", detect: ["Gemfile"] },
	{ name: "C/C++", detect: ["CMakeLists.txt", "Makefile"] },
	{ name: "Swift", detect: ["Package.swift"] },
];

export function detectLanguage(root: string): string | null {
	const entries: string[] = [];
	try {
		const files = readdirSync(root);
		entries.push(...files);
	} catch {
		return null;
	}

	for (const lang of LANGUAGE_REGISTRY) {
		for (const pattern of lang.detect) {
			if (pattern.startsWith("*.")) {
				const ext = pattern.slice(1);
				if (entries.some((e) => e.endsWith(ext))) return lang.name;
			}
			if (entries.includes(pattern)) return lang.name;
		}
	}

	return null;
}

export function getLanguageDisplay(lang: string | null): string {
	return lang ?? "general";
}
