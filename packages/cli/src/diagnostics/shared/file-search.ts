import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SEARCH_DIRS = ["packages/cli/src", "packages/client/src", "packages/ui/src"];

export function searchInSource(rootDir: string, terms: string[], extensions = [".ts", ".tsx"]): boolean {
	for (const searchDir of SEARCH_DIRS) {
		const dir = join(rootDir, searchDir);
		if (!existsSync(dir)) continue;
		try {
			const files = walkDir(dir, extensions);
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

export function walkDir(dir: string, extensions = [".ts", ".tsx"]): string[] {
	const files: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory() && entry.name !== "node_modules") {
				files.push(...walkDir(fullPath, extensions));
			} else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
				files.push(fullPath);
			}
		}
	} catch {}
	return files;
}

export function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
