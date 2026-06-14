import { existsSync } from "node:fs";
import { join } from "node:path";
import { SnapshotStore } from "./snapshot.js";
import { acStaleDetector } from "./detectors/ac-stale.js";
import { missingDirDetector } from "./detectors/missing-dir.js";
import { deadIconsDetector } from "./detectors/dead-icons.js";
import { stageDriftDetector } from "./detectors/stage-drift.js";
import type { DiagnosticResult } from "./types.js";

export type DiagnosticType = "info" | "warning" | "error";

export interface DiagnosticOutput {
	fixes: { id: string; title: string; description: string; snapshotId: string }[];
	suggestions: {
		id: string;
		title: string;
		description: string;
		type: DiagnosticType;
		detector: string;
	}[];
	errors: string[];
}

export class DiagnosticEngine {
	private rootDir: string;
	private snapshots: SnapshotStore;
	private detectors = [
		acStaleDetector,
		missingDirDetector,
		deadIconsDetector,
		stageDriftDetector,
	];
	private lastOutput: DiagnosticOutput = { fixes: [], suggestions: [], errors: [] };

	constructor(rootDir: string) {
		this.rootDir = rootDir;
		this.snapshots = new SnapshotStore(rootDir);
	}

	async runAll(): Promise<DiagnosticOutput> {
		const output: DiagnosticOutput = { fixes: [], suggestions: [], errors: [] };

		for (const detector of this.detectors) {
			try {
				const results = await detector.run(this.rootDir);
				for (const result of results) {
					if (result.autoFix && result.certainty >= 0.9) {
						try {
							const fix = await result.autoFix();
							const snapshotId = await this.snapshots.save(
								result.id,
								result.title,
								fix.files,
							);
							output.fixes.push({
								id: result.id,
								title: result.title,
								description: result.description,
								snapshotId,
							});
						} catch (fixError) {
							output.errors.push(`Auto-fix falhou para ${result.id}: ${fixError}`);
						}
					} else {
						output.suggestions.push({
							id: result.id,
							title: result.title,
							description: result.description,
							type: result.type,
							detector: result.detector,
						});
					}
				}
			} catch (detError) {
				output.errors.push(`Detector ${detector.name} falhou: ${detError}`);
			}
		}

		this.lastOutput = output;
		return output;
	}

	getLastOutput(): DiagnosticOutput {
		return this.lastOutput;
	}

	async undo(snapshotId: string): Promise<{ ok: boolean; restoredFiles: string[] }> {
		return this.snapshots.restore(snapshotId);
	}

	listSnapshots() {
		return this.snapshots.list();
	}

	ensureDirs(): void {
		const requiredDirs = [".letra/templates", ".letra/brand", ".letra/snapshots"];
		for (const dir of requiredDirs) {
			const fullPath = join(this.rootDir, dir);
			if (!existsSync(fullPath)) {
				try {
					const { mkdirSync } = require("node:fs");
					mkdirSync(fullPath, { recursive: true });
				} catch {
					/* best effort */
				}
			}
		}
	}
}
