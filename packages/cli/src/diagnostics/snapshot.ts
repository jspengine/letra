import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "./types.js";

const SNAPSHOTS_DIR = ".letra/snapshots";
const TTL_DAYS = 30;

export class SnapshotStore {
	private rootDir: string;
	private snapshotsDir: string;

	constructor(rootDir: string) {
		this.rootDir = rootDir;
		this.snapshotsDir = join(rootDir, SNAPSHOTS_DIR);
		if (!existsSync(this.snapshotsDir)) {
			mkdirSync(this.snapshotsDir, { recursive: true });
		}
		this.cleanup();
	}

	async save(
		diagnosticId: string,
		diagnosticTitle: string,
		files: { path: string; before: string; after: string }[],
	): Promise<string> {
		const id = `${Date.now()}_${diagnosticId}`;
		const snapshot: Snapshot = {
			id,
			timestamp: new Date().toISOString(),
			diagnosticId,
			diagnosticTitle,
			files,
		};
		writeFileSync(
			join(this.snapshotsDir, `${id}.json`),
			JSON.stringify(snapshot, null, 2),
			"utf-8",
		);
		return id;
	}

	async restore(snapshotId: string): Promise<{ ok: boolean; restoredFiles: string[] }> {
		const filePath = join(this.snapshotsDir, `${snapshotId}.json`);
		if (!existsSync(filePath)) {
			return { ok: false, restoredFiles: [] };
		}
		const snapshot: Snapshot = JSON.parse(readFileSync(filePath, "utf-8"));
		const restoredFiles: string[] = [];
		for (const file of snapshot.files) {
			const absolutePath = join(this.rootDir, file.path);
			writeFileSync(absolutePath, file.before, "utf-8");
			restoredFiles.push(file.path);
		}
		rmSync(filePath);
		return { ok: true, restoredFiles };
	}

	list(): Snapshot[] {
		if (!existsSync(this.snapshotsDir)) return [];
		return readdirSync(this.snapshotsDir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => {
				const content = readFileSync(join(this.snapshotsDir, f), "utf-8");
				return JSON.parse(content) as Snapshot;
			})
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	}

	private cleanup(): void {
		if (!existsSync(this.snapshotsDir)) return;
		const cutoff = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000;
		for (const file of readdirSync(this.snapshotsDir)) {
			if (!file.endsWith(".json")) continue;
			const filePath = join(this.snapshotsDir, file);
			const stat = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
			if (stat) {
				const snapshot = JSON.parse(stat) as Snapshot;
				if (new Date(snapshot.timestamp).getTime() < cutoff) {
					rmSync(filePath);
				}
			}
		}
	}
}
