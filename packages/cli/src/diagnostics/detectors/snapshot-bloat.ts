import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult, Snapshot } from "../types.js";

const BLOAT_THRESHOLD = 50 * 1024;

export const snapshotBloatDetector: Detector = {
	name: "snapshot-bloat",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const snapshotsDir = join(rootDir, ".letra", "snapshots");
		if (!existsSync(snapshotsDir)) return [];

		const snapshots: Snapshot[] = readdirSync(snapshotsDir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => {
				const content = readFileSync(join(snapshotsDir, f), "utf-8");
				return JSON.parse(content) as Snapshot;
			});

		if (snapshots.length === 0) return [];

		const payload = JSON.stringify({ snapshots });
		const size = Buffer.byteLength(payload, "utf-8");

		if (size <= BLOAT_THRESHOLD) return [];

		return [
			{
				id: "snapshot-bloat",
				type: "warning",
				title: "Snapshot payload excede 50KB",
				description: `Payload serializado de snapshots é ${(size / 1024).toFixed(1)}KB (> 50KB). Considere usar ?limit e ?offset ao chamar GET /api/diagnostics/snapshots.`,
				certainty: 0.9,
				detector: "snapshot-bloat",
				autoFix: async () => {
					const servePath = join(
						rootDir,
						"packages",
						"cli",
						"src",
						"commands",
						"flow-serve.ts",
					);
					const original = readFileSync(servePath, "utf-8");
					const oldCode = `if (path === "/api/diagnostics/snapshots" && req.method === "GET") {
\t\t\tconst snapshots = this.engine.listSnapshots();
\t\t\tres.writeHead(200, { "Content-Type": "application/json" });
\t\t\tres.end(JSON.stringify({ snapshots }));
\t\t\treturn;
\t\t}`;
					const newCode = `if (path === "/api/diagnostics/snapshots" && req.method === "GET") {
\t\t\tconst snapshots = this.engine.listSnapshots();
\t\t\tconst raw = JSON.stringify({ snapshots });
\t\t\tconst headers: Record<string, string> = { "Content-Type": "application/json" };
\t\t\tif (Buffer.byteLength(raw, "utf-8") > 51200) {
\t\t\t\theaders["Warning"] = '299 - "snapshot-payload-large; use ?limit and ?offset"';
\t\t\t}
\t\t\tres.writeHead(200, headers);
\t\t\tres.end(raw);
\t\t\treturn;
\t\t}`;
					if (!original.includes(oldCode)) {
						return { files: [], snapshotId: "no-op" };
					}
					const after = original.replace(oldCode, newCode);
					return {
						snapshotId: "snapshot-bloat-fix",
						files: [
							{
								path: "packages/cli/src/commands/flow-serve.ts",
								before: original,
								after,
							},
						],
					};
				},
			},
		];
	},
};
