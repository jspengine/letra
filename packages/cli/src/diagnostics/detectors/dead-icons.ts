import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import type { Detector, DiagnosticResult } from "../types.js";

const ICON_USAGE_PATTERN = /<Icon\s+name="([^"]+)"/g;
const ICON_DEF_PATTERN = /"([a-z-]+)":\s*\(/g;

export const deadIconsDetector: Detector = {
	name: "dead-icons",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const iconFiles = findIconFiles(rootDir);

		if (iconFiles.length === 0) return results;

		const definedIcons = new Set<string>();
		const usedIcons = new Set<string>();

		for (const file of iconFiles) {
			const content = readFileSync(file, "utf-8");
			const defs = content.matchAll(ICON_DEF_PATTERN);
			for (const d of defs) {
				definedIcons.add(d[1]);
			}
			const usages = content.matchAll(ICON_USAGE_PATTERN);
			for (const u of usages) {
				usedIcons.add(u[1]);
			}
		}

		const srcDir = join(rootDir, "packages", "client", "src");
		if (existsSync(srcDir)) {
			const files = walkDir(srcDir);
			for (const file of files) {
				const content = readFileSync(file, "utf-8");
				const usages = content.matchAll(ICON_USAGE_PATTERN);
				for (const u of usages) {
					usedIcons.add(u[1]);
				}
			}
		}

		for (const iconName of usedIcons) {
			if (definedIcons.has(iconName)) continue;

			results.push({
				id: `dead-icons_${iconName}`,
				type: "warning",
				title: `Ícone "${iconName}" referenciado mas não definido`,
				description: `O ícone "${iconName}" é usado em <Icon name="${iconName}" /> mas não está definido no ICONS map. Renderiza null silenciosamente.`,
				certainty: 1,
				detector: "dead-icons",
				autoFix: async () => {
					const fixes: { path: string; before: string; after: string }[] = [];
					for (const file of iconFiles) {
						const content = readFileSync(file, "utf-8");
						if (!content.includes("const ICONS")) continue;

						const lines = content.split("\n");
						const insertLine = lines.findIndex(
							(l) => l.includes("];") || l.includes("};"),
						);
						if (insertLine === -1) continue;

						const indent = "	";
						const iconSvg = `${indent}"${iconName}": () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,`;

						const before = content;
						const afterLines = [...lines];
						afterLines.splice(insertLine, 0, iconSvg);
						const after = afterLines.join("\n");

						fixes.push({
							path: file.replace(`${rootDir}\\`, "").replace(/\\/g, "/"),
							before,
							after,
						});
					}
					return { files: fixes, snapshotId: "" };
				},
			});
		}

		return results;
	},
};

function findIconFiles(rootDir: string): string[] {
	const candidates = [
		join(rootDir, "packages", "client", "src", "components", "ui", "icon.tsx"),
		join(rootDir, "packages", "ui", "src", "icon.tsx"),
	];
	return candidates.filter((f) => existsSync(f));
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
				(entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
			) {
				files.push(fullPath);
			}
		}
	} catch {
		/* skip */
	}
	return files;
}
