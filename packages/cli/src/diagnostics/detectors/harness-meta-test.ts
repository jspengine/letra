import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";

const REQUIRED_DETECTORS = [
	"ac-stale",
	"ac-false-pos",
	"harness-stale",
	"missing-dir",
	"stage-drift",
	"missing-spec-link",
];

const ENGINE_PATH = "packages/cli/src/diagnostics/engine.ts";
const SNAPSHOT_PATH = "packages/cli/src/diagnostics/snapshot.ts";

export const harnessMetaTestDetector: Detector = {
	name: "harness-meta-test",
	devOnly: true,
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const engineFile = join(rootDir, ENGINE_PATH);
		const snapshotFile = join(rootDir, SNAPSHOT_PATH);

		const engineContent = existsSync(engineFile)
			? readFileSync(engineFile, "utf-8")
			: "";
		const snapshotContent = existsSync(snapshotFile)
			? readFileSync(snapshotFile, "utf-8")
			: "";

		if (!engineContent) {
			results.push({
				id: "harness-meta-test_engine-not-found",
				type: "error",
				title: "engine.ts não encontrado",
				description: "O arquivo engine.ts está ausente — o harness de diagnóstico não pode ser validado.",
				certainty: 1,
				detector: "harness-meta-test",
			});
			return results;
		}

		// AC1: check required detectors are registered
		const missingDetectors: string[] = [];
		for (const name of REQUIRED_DETECTORS) {
			const varName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Detector";
			if (!engineContent.includes(varName)) {
				missingDetectors.push(name);
			}
		}

		if (missingDetectors.length > 0) {
			const desc = `Detectores obrigatórios ausentes em engine.ts: ${missingDetectors.join(", ")}.`;
			results.push({
				id: `harness-meta-test_missing-detectors`,
				type: "error",
				title: `Detectores ausentes no harness`,
				description: desc,
				certainty: 1,
				detector: "harness-meta-test",
				autoFix: async () => {
					const addLines = missingDetectors
						.map((n) => {
							const varName =
								n.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Detector";
							return `// import { ${varName} } from "./detectors/${n}.js"; — TODO: implement`;
						})
						.join("\n");
					return {
						files: [
							{
								path: ENGINE_PATH,
								before: engineContent,
								after: engineContent + "\n" + addLines + "\n",
							},
						],
						snapshotId: `harness-meta-test_add-placeholder-${Date.now()}`,
					};
				},
			});
		}

		// AC2: check TTL_MS
		if (snapshotContent) {
			const ttlMatch = snapshotContent.match(/TTL_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/);
			const expectedValue = 30 * 24 * 60 * 60 * 1000;
			if (ttlMatch) {
				const computed =
					Number(ttlMatch[1]) *
					Number(ttlMatch[2]) *
					Number(ttlMatch[3]) *
					Number(ttlMatch[4]) *
					Number(ttlMatch[5]);
				if (computed !== expectedValue) {
					results.push({
						id: `harness-meta-test_ttl-wrong`,
						type: "warning",
						title: `TTL_MS não corresponde a 30 dias`,
						description: `TTL_MS calculado como ${computed}ms, esperado ${expectedValue}ms (30 dias).`,
						certainty: 1,
						detector: "harness-meta-test",
					});
				}
			} else {
				results.push({
					id: `harness-meta-test_ttl-not-found`,
					type: "warning",
					title: "TTL_MS não encontrado",
					description: "Não foi possível encontrar a constante TTL_MS em snapshot.ts.",
					certainty: 1,
					detector: "harness-meta-test",
				});
			}

			// Also check MAX_SNAPSHOTS >= 20
			const snapMatch = snapshotContent.match(/MAX_SNAPSHOTS\s*=\s*(\d+)/);
			if (snapMatch) {
				const val = parseInt(snapMatch[1], 10);
				if (val < 20) {
					results.push({
						id: `harness-meta-test_max-snapshots-low`,
						type: "warning",
						title: `MAX_SNAPSHOTS (${val}) < 20`,
						description: `MAX_SNAPSHOTS é ${val}, mas o mínimo esperado é 20.`,
						certainty: 1,
						detector: "harness-meta-test",
					});
				}
			}
		}

		// AC3: check certainty/autoFix consistency for all registered detectors
		const detectorFiles = [
			"ac-stale.ts",
			"ac-false-pos.ts",
			"stage-drift.ts",
			"missing-dir.ts",
			"harness-stale.ts",
			"spec-code-drift.ts",
			"snapshot-bloat.ts",
			"cross-spec-dep.ts",
		];

		for (const df of detectorFiles) {
			const filePath = join(rootDir, "packages/cli/src/diagnostics/detectors", df);
			if (!existsSync(filePath)) continue;
			const content = readFileSync(filePath, "utf-8");

			const certMatch = content.match(/certainty:\s*([\d.]+)/);
			if (!certMatch) continue;
			const certainty = parseFloat(certMatch[1]);
			const hasAutoFix = content.includes("autoFix");

			if (certainty >= 0.9 && !hasAutoFix) {
				results.push({
					id: `harness-meta-test_${df.replace(".ts", "")}-missing-autofix`,
					type: "warning",
					title: `Detector ${df.replace(".ts", "")} com certainty ${certainty} ≥ 0.9 mas sem autoFix`,
					description: `Todo detector com certainty ≥ 0.9 deve ter autoFix. ${df.replace(".ts", "")} tem certainty ${certainty} mas não implementa autoFix.`,
					certainty: 1,
					detector: "harness-meta-test",
				});
			}

			if (certainty < 0.9 && hasAutoFix) {
				results.push({
					id: `harness-meta-test_${df.replace(".ts", "")}-unexpected-autofix`,
					type: "info",
					title: `Detector ${df.replace(".ts", "")} com certainty ${certainty} < 0.9 mas tem autoFix`,
					description: `Detectores com certainty < 0.9 normalmente não devem ter autoFix. ${df.replace(".ts", "")} tem certainty ${certainty} e implementa autoFix.`,
					certainty: 1,
					detector: "harness-meta-test",
				});
			}
		}

		return results;
	},
};
