import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function searchInSource(
	rootDir: string,
	terms: string[],
	extensions = [".ts", ".tsx"],
	targetDirs?: string[],
): boolean {
	const searchDirs = targetDirs ?? ["packages/cli/src", "packages/client/src", "packages/ui/src"];
	for (const searchDir of searchDirs) {
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

export function buildTargetSearchDirs(workflow: { locations?: Array<{ path: string; projectType?: string }> } | null): { dirs: string[]; isGeneral: boolean } {
	if (!workflow?.locations || workflow.locations.length === 0) {
		return { dirs: [".", "packages/cli/src", "packages/client/src", "packages/ui/src"], isGeneral: false };
	}
	const isGeneral = workflow.locations.some((location) => location.projectType === "general");
	return {
		dirs: workflow.locations.map((location) => location.path),
		isGeneral,
	};
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
