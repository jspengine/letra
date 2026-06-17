import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "./types.js";

const SNAPSHOTS_DIR = ".letra/snapshots";
const MAX_SNAPSHOTS = 20;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
		this.enforceMax();
	}

	async save(
		diagnosticId: string,
		diagnosticTitle: string,
		files: { path: string; before: string; after: string }[],
	): Promise<string | null> {
		if (this.isDuplicate(diagnosticId, files)) {
			return null;
		}

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
			JSON.stringify(snapshot, null, 0),
			"utf-8",
		);

		this.enforceMax();

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
		return { ok: true, restoredFiles };
	}

	async redo(snapshotId: string): Promise<{ ok: boolean; redoneFiles: string[] }> {
		const filePath = join(this.snapshotsDir, `${snapshotId}.json`);
		if (!existsSync(filePath)) {
			return { ok: false, redoneFiles: [] };
		}
		const snapshot: Snapshot = JSON.parse(readFileSync(filePath, "utf-8"));
		const redoneFiles: string[] = [];
		for (const file of snapshot.files) {
			const absolutePath = join(this.rootDir, file.path);
			writeFileSync(absolutePath, file.after, "utf-8");
			redoneFiles.push(file.path);
		}
		return { ok: true, redoneFiles };
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

	private isDuplicate(
		diagnosticId: string,
		files: { path: string; before: string; after: string }[],
	): boolean {
		const last = this.getLastForDiagnostic(diagnosticId);
		if (!last) return false;
		if (last.files.length !== files.length) return false;
		for (let i = 0; i < files.length; i++) {
			if (last.files[i]?.after !== files[i]?.after) return false;
		}
		return true;
	}

	private getLastForDiagnostic(diagnosticId: string): Snapshot | null {
		if (!existsSync(this.snapshotsDir)) return null;
		const entries = readdirSync(this.snapshotsDir).filter(
			(f) => f.endsWith(".json") && f.includes(`_${diagnosticId}`),
		);
		if (entries.length === 0) return null;
		entries.sort().reverse();
		try {
			const content = readFileSync(join(this.snapshotsDir, entries[0]), "utf-8");
			return JSON.parse(content) as Snapshot;
		} catch {
			return null;
		}
	}

	private enforceMax(): void {
		if (!existsSync(this.snapshotsDir)) return;
		const entries = readdirSync(this.snapshotsDir)
			.filter((f) => f.endsWith(".json"))
			.sort();
		while (entries.length > MAX_SNAPSHOTS) {
			const oldest = entries.shift();
			if (oldest) {
				rmSync(join(this.snapshotsDir, oldest));
			}
		}
	}

	private cleanup(): void {
		if (!existsSync(this.snapshotsDir)) return;
		const cutoff = Date.now() - TTL_MS;
		for (const file of readdirSync(this.snapshotsDir)) {
			if (!file.endsWith(".json")) continue;
			try {
				const filePath = join(this.snapshotsDir, file);
				const snapshot: Snapshot = JSON.parse(readFileSync(filePath, "utf-8"));
				if (new Date(snapshot.timestamp).getTime() < cutoff) {
					rmSync(filePath);
				}
			} catch {
				/* skip corrupt files */
			}
		}
	}
}
