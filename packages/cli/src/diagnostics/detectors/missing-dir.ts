import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";

const REQUIRED_DIRS = [
	{
		path: ".letra/templates",
		spec: "spec-templates-domain",
		description: "templates customizados de specs",
	},
	{ path: ".letra/brand", spec: "flow-serve", description: "logos SVG do Letra" },
];

export const missingDirDetector: Detector = {
	name: "missing-dir",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];

		for (const required of REQUIRED_DIRS) {
			const dirPath = join(rootDir, required.path);
			if (existsSync(dirPath)) continue;

			results.push({
				id: `missing-dir_${required.path.replace(/[/.]/g, "-")}`,
				type: "info",
				title: `Diretório ausente: ${required.path}/`,
				description: `O diretório ${required.path}/ é referenciado pelo spec ${required.spec} (${required.description}), mas não existe.`,
				certainty: 1,
				detector: "missing-dir",
				autoFix: async () => ({
					files: [],
					snapshotId: "",
				}),
			});
		}

		for (const r of results) {
			const originalAutoFix = r.autoFix;
			if (!originalAutoFix) continue;
			r.autoFix = async () => {
				const dirs: string[] = [];
				for (const required of REQUIRED_DIRS) {
					const dirPath = join(rootDir, required.path);
					if (existsSync(dirPath)) continue;
					mkdirSync(dirPath, { recursive: true });
					dirs.push(required.path);
				}
				return {
					files: [],
					snapshotId: "",
				};
			};
		}

		return results;
	},
};
