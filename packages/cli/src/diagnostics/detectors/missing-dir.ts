import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getLetraDir } from "../../workspace/resolver.js";
import type { Detector, DiagnosticResult } from "../types.js";

const REQUIRED_DIRS = [
	{
		path: "templates",
		spec: "spec-templates-domain",
		description: "templates customizados de specs",
	},
	{ path: "brand", spec: "flow-serve", description: "logos SVG do Letra" },
];

export const missingDirDetector: Detector = {
	name: "missing-dir",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const dataDir = getLetraDir(rootDir);

		for (const required of REQUIRED_DIRS) {
			const dirPath = join(dataDir, required.path);
			if (existsSync(dirPath)) continue;

			results.push({
				id: `missing-dir_${required.path.replace(/[/.]/g, "-")}`,
				type: "info",
				title: `Diretório ausente: ${required.path}/`,
				description: `O diretório ${required.path}/ é referenciado pelo spec ${required.spec} (${required.description}), mas não existe no dataDir do workspace.`,
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
					const dirPath = join(dataDir, required.path);
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
