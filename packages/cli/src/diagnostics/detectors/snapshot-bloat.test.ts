import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { snapshotBloatDetector } from "./snapshot-bloat.js";
import { SnapshotStore } from "../snapshot.js";

describe("snapshot-bloat detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-snapshot-bloat-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should return empty when no snapshots exist", async () => {
		const results = await snapshotBloatDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should NOT warn when snapshot payload <= 50KB", async () => {
		const store = new SnapshotStore(tmpDir);
		await store.save("test", "test", [
			{ path: "test.ts", before: "", after: "a".repeat(500) },
		]);

		const results = await snapshotBloatDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should warn when snapshot payload > 50KB", async () => {
		const snapshotsDir = join(tmpDir, ".letra", "snapshots");
		mkdirSync(snapshotsDir, { recursive: true });

		const bigFile = "x".repeat(30 * 1024);
		for (let i = 0; i < 3; i++) {
			writeFileSync(
				join(snapshotsDir, `${Date.now() + i}_bloat.json`),
				JSON.stringify({
					id: `bloat-${i}`,
					timestamp: new Date().toISOString(),
					diagnosticId: "bloat",
					diagnosticTitle: "bloat",
					files: [
						{ path: "big.ts", before: "", after: bigFile },
						{ path: "big2.ts", before: "", after: bigFile },
					],
				}),
			);
		}

		const results = await snapshotBloatDetector.run(tmpDir);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("snapshot-bloat");
		expect(results[0].certainty).toBe(0.9);
		expect(results[0].autoFix).toBeDefined();
		expect(results[0].description).toContain("50KB");
	});

	it("should auto-fix modify flow-serve.ts (returns correct file path)", async () => {
		const srcDir = join(tmpDir, "packages", "cli", "src", "commands");
		mkdirSync(srcDir, { recursive: true });
		const oldEndpoint = `if (path === "/api/diagnostics/snapshots" && req.method === "GET") {
\t\t\tconst snapshots = this.engine.listSnapshots();
\t\t\tres.writeHead(200, { "Content-Type": "application/json" });
\t\t\tres.end(JSON.stringify({ snapshots }));
\t\t\treturn;
\t\t}`;
		writeFileSync(join(srcDir, "flow-serve.ts"), oldEndpoint);

		const snapshotsDir = join(tmpDir, ".letra", "snapshots");
		mkdirSync(snapshotsDir, { recursive: true });
		writeFileSync(
			join(snapshotsDir, "big.json"),
			JSON.stringify({
				id: "big",
				timestamp: new Date().toISOString(),
				diagnosticId: "big",
				diagnosticTitle: "big",
				files: [
					{ path: "big.ts", before: "", after: "x".repeat(60 * 1024) },
				],
			}),
		);

		const results = await snapshotBloatDetector.run(tmpDir);
		expect(results).toHaveLength(1);

		const fix = await results[0].autoFix!();
		expect(fix.files).toHaveLength(1);
		expect(fix.files[0].path).toBe("packages/cli/src/commands/flow-serve.ts");
		expect(fix.files[0].after).toContain("Warning");
		expect(fix.files[0].after).toContain("snapshot-payload-large");
	});
});

describe("snapshot pagination (via SnapshotStore)", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-pagination-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should list all snapshots by default (no pagination)", async () => {
		const store = new SnapshotStore(tmpDir);
		for (let i = 0; i < 5; i++) {
			await store.save(`test-${i}`, `test-${i}`, [
				{ path: `${i}.ts`, before: "", after: "a" },
			]);
		}
		const all = store.list();
		expect(all).toHaveLength(5);
	});

	it("should support pagination via slice", async () => {
		const store = new SnapshotStore(tmpDir);
		for (let i = 0; i < 10; i++) {
			await store.save(`test-${i}`, `test-${i}`, [
				{ path: `${i}.ts`, before: "", after: "a" },
			]);
		}
		const all = store.list();
		expect(all).toHaveLength(10);

		const limit = 3;
		const offset = 2;
		const sliced = all.slice(offset, offset + limit);
		expect(sliced).toHaveLength(3);
	});
});
