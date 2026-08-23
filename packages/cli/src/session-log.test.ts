import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	loadSessionLog,
	logEntry,
	pruneSessionLog,
	queryLog,
	queryLogWithMeta,
	saveSessionLog,
} from "./session-log.js";
import type { SessionLog } from "./session-log.js";

describe("session-log", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-log-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	describe("loadSessionLog", () => {
		it("should return empty log when file does not exist", () => {
			const log = loadSessionLog(tmpDir);
			expect(log.schemaVersion).toBe(1);
			expect(log.entries).toEqual([]);
		});

		it("should handle corrupt JSON gracefully", () => {
			const dir = join(tmpDir, ".letra");
			mkdirSync(dir, { recursive: true });
			const { writeFileSync } = require("node:fs");
			writeFileSync(join(dir, "session-log.json"), "{invalid");
			const log = loadSessionLog(tmpDir);
			expect(log.entries).toEqual([]);
		});
	});

	describe("logEntry", () => {
		it("should add entry to the log", () => {
			const entry = logEntry(tmpDir, "manual", "Test entry", { itemId: "ITEM-1" });
			expect(entry.action).toBe("manual");
			expect(entry.description).toBe("Test entry");
			expect(entry.itemId).toBe("ITEM-1");
			expect(entry.level).toBe("info");
			expect(entry.id).toMatch(/^log-/);
		});

		it("should persist log to disk", () => {
			logEntry(tmpDir, "manual", "Persist test");
			const log = loadSessionLog(tmpDir);
			expect(log.entries).toHaveLength(1);
			expect(log.entries[0].description).toBe("Persist test");
		});

		it("writes entries to the daily JSONL file", () => {
			logEntry(tmpDir, "manual", "JSONL test");
			const now = new Date();
			const file = join(
				tmpDir,
				".letra",
				"session-log",
				String(now.getUTCFullYear()),
				String(now.getUTCMonth() + 1).padStart(2, "0"),
				`${String(now.getUTCDate()).padStart(2, "0")}.jsonl`,
			);
			expect(existsSync(file)).toBe(true);
			const lines = readFileSync(file, "utf-8").trim().split(/\r?\n/);
			expect(lines).toHaveLength(1);
			expect(JSON.parse(lines[0]).description).toBe("JSONL test");
		});

		it("marks system actions as debug", () => {
			const entry = logEntry(tmpDir, "system", "System event", {
				details: { systemAction: true },
			});
			expect(entry.level).toBe("debug");
		});

		it("should handle all action types", () => {
			const actions = [
				"validate", "diagnose", "health_scan", "health_ack", "health_dismiss",
				"ac_complete", "ac_done", "item_move", "decision", "sitrep", "focus_set", "manual", "session_end",
				"handoff", "handoff_emitted", "handoff_rollback", "item_reclaim",
			] as const;
			for (const action of actions) {
				const entry = logEntry(tmpDir, action, `${action} entry`);
				expect(entry.action).toBe(action);
			}
			const log = loadSessionLog(tmpDir);
			expect(log.entries).toHaveLength(actions.length);
		});

		it("should include details", () => {
			const entry = logEntry(tmpDir, "validate", "Validation done", {
				itemId: "ITEM-1",
				acId: "AC-001",
				details: { passed: 5, failed: 0 },
			});
			expect(entry.itemId).toBe("ITEM-1");
			expect(entry.acId).toBe("AC-001");
			expect(entry.details).toEqual({ passed: 5, failed: 0 });
		});

		it("should preserve entries up to MAX_ENTRIES", () => {
			for (let i = 0; i < 510; i++) {
				logEntry(tmpDir, "manual", `Entry ${i}`);
			}
			const log = loadSessionLog(tmpDir);
			expect(log.entries.length).toBe(510);
			expect(log.entries[0].description).toBe("Entry 0");
			expect(log.entries[log.entries.length - 1].description).toBe("Entry 509");
		});
	});

	describe("saveSessionLog", () => {
		it("retries a transient Windows replacement error and preserves valid JSON", () => {
			const letraDir = join(tmpDir, ".letra");
			const file = join(letraDir, "session-log.json");
			mkdirSync(letraDir, { recursive: true });
			writeFileSync(file, JSON.stringify({ schemaVersion: 1, entries: [] }));
			let attempts = 0;

			saveSessionLog(
				tmpDir,
				{
					schemaVersion: 1,
					entries: [
						{
							id: "log-test-001",
							timestamp: new Date().toISOString(),
							action: "manual",
							description: "Preserved after contention",
							itemId: null,
							acId: null,
							details: {},
						},
					],
				},
				{
					replaceFile: (source, destination) => {
						attempts++;
						if (attempts === 1) {
							throw Object.assign(new Error("unknown error"), { code: "UNKNOWN" });
						}
						renameSync(source, destination);
					},
					sleep: () => {},
				},
			);

			expect(attempts).toBe(2);
			expect(JSON.parse(readFileSync(file, "utf-8")).entries).toHaveLength(1);
		});

		it("keeps the previous valid file when replacement persistently fails", () => {
			const letraDir = join(tmpDir, ".letra");
			const file = join(letraDir, "session-log.json");
			const previous = { schemaVersion: 1, entries: [] };
			mkdirSync(letraDir, { recursive: true });
			writeFileSync(file, JSON.stringify(previous));

			expect(() =>
				saveSessionLog(
					tmpDir,
					{ schemaVersion: 1, entries: [] },
					{
						replaceFile: () => {
							throw Object.assign(new Error("busy"), { code: "EBUSY" });
						},
						sleep: () => {},
					},
				),
			).toThrow("busy");

			expect(JSON.parse(readFileSync(file, "utf-8"))).toEqual(previous);
		});
	});

	describe("queryLog", () => {
		beforeEach(() => {
			logEntry(tmpDir, "validate", "Validation 1", { itemId: "ITEM-1" });
			logEntry(tmpDir, "item_move", "Move ITEM-1", { itemId: "ITEM-1", details: { from: "backlog", to: "design" } });
			logEntry(tmpDir, "manual", "Working on AC-001", { itemId: "ITEM-1", acId: "AC-001" });
			logEntry(tmpDir, "decision", "Chose X over Y", { itemId: "ITEM-2" });
			logEntry(tmpDir, "session_end", "Session over", { itemId: "ITEM-1" });
		});

		it("should return last 10 entries by default", () => {
			const entries = queryLog(tmpDir);
			expect(entries).toHaveLength(5);
		});

		it("should return all entries with --all", () => {
			const entries = queryLog(tmpDir, { all: true });
			expect(entries).toHaveLength(5);
		});

		it("should hide debug entries by default and include them with debug", () => {
			logEntry(tmpDir, "system", "System event", {
				details: { systemAction: true },
			});
			expect(queryLog(tmpDir, { all: true }).map((entry) => entry.action)).not.toContain("system");
			expect(queryLog(tmpDir, { all: true, debug: true }).map((entry) => entry.action)).toContain("system");
		});

		it("should filter by itemId", () => {
			const entries = queryLog(tmpDir, { all: true, itemId: "ITEM-2" });
			expect(entries).toHaveLength(1);
			expect(entries[0].action).toBe("decision");
		});

		it("should filter by action", () => {
			const entries = queryLog(tmpDir, { all: true, action: "validate" });
			expect(entries).toHaveLength(1);
			expect(entries[0].action).toBe("validate");
		});

		it("should filter by since date", () => {
			const past = new Date(Date.now() - 86400000).toISOString();
			const entries = queryLog(tmpDir, { all: true, since: past });
			expect(entries).toHaveLength(5);
		});

		it("should respect limit", () => {
			const entries = queryLog(tmpDir, { limit: 2 });
			expect(entries).toHaveLength(2);
		});

		it("should return entries in reverse chronological order", () => {
			const entries = queryLog(tmpDir, { all: true });
			for (let i = 1; i < entries.length; i++) {
				expect(new Date(entries[i - 1].timestamp).getTime())
					.toBeGreaterThanOrEqual(new Date(entries[i].timestamp).getTime());
			}
		});
	});

	describe("queryLog — text search", () => {
		beforeEach(() => {
			logEntry(tmpDir, "manual", "Working on authentication");
			logEntry(tmpDir, "validate", "Validation passed for auth module");
			logEntry(tmpDir, "item_move", "Move ITEM-42 to review");
		});

		it("should filter by text query matching description", () => {
			const entries = queryLog(tmpDir, { all: true, q: "auth" });
			expect(entries).toHaveLength(2);
		});

		it("should filter by text query matching action", () => {
			const entries = queryLog(tmpDir, { all: true, q: "validate" });
			expect(entries).toHaveLength(1);
			expect(entries[0].action).toBe("validate");
		});

		it("should return empty when no match", () => {
			const entries = queryLog(tmpDir, { all: true, q: "zzzzz" });
			expect(entries).toHaveLength(0);
		});
	});

	describe("queryLog — date range", () => {
		it("should filter by from date", () => {
			const future = new Date(Date.now() + 86400000).toISOString();
			const entries = queryLog(tmpDir, { all: true, from: future });
			expect(entries).toHaveLength(0);
		});

		it("should filter by to date", () => {
			const past = new Date(Date.now() - 86400000).toISOString();
			const entries = queryLog(tmpDir, { all: true, to: past });
			expect(entries).toHaveLength(0);
		});
	});

	describe("queryLogWithMeta", () => {
		beforeEach(() => {
			for (let i = 0; i < 5; i++) {
				logEntry(tmpDir, "manual", `Entry ${i}`);
			}
		});

		it("should return total count without pagination slicing", () => {
			const result = queryLogWithMeta(tmpDir, { limit: 2 });
			expect(result.total).toBe(5);
			expect(result.entries).toHaveLength(2);
		});

		it("should compute facets", () => {
			logEntry(tmpDir, "system", "System event", {
				details: { systemAction: true, outcome: "failed" },
			});
			const result = queryLogWithMeta(tmpDir, { all: true, debug: true });
			expect(result.facets.actions.manual).toBeGreaterThanOrEqual(5);
			expect(result.facets.actions.system).toBe(1);
		});
	});

	describe("legacy and retention", () => {
		it("merges legacy JSON and rotated JSONL entries", () => {
			saveSessionLog(tmpDir, {
				schemaVersion: 1,
				entries: [
					{
						id: "legacy-1",
						timestamp: "2026-07-24T10:00:00.000Z",
						action: "manual",
						description: "Legacy entry",
						itemId: null,
						acId: null,
						details: {},
					},
				],
			});
			logEntry(tmpDir, "manual", "JSONL entry");
			const entries = queryLog(tmpDir, { all: true });
			expect(entries.map((entry) => entry.description)).toEqual(["JSONL entry", "Legacy entry"]);
		});

		it("prunes JSONL files older than the retention window", () => {
			const oldDir = join(tmpDir, ".letra", "session-log", "2026", "07");
			mkdirSync(oldDir, { recursive: true });
			const oldFile = join(oldDir, "01.jsonl");
			const recentFile = join(oldDir, "25.jsonl");
			writeFileSync(oldFile, JSON.stringify({
				id: "old",
				timestamp: "2026-07-01T10:00:00.000Z",
				action: "manual",
				description: "Old",
				itemId: null,
				acId: null,
				details: {},
			}) + "\n");
			writeFileSync(recentFile, JSON.stringify({
				id: "recent",
				timestamp: "2026-07-25T10:00:00.000Z",
				action: "manual",
				description: "Recent",
				itemId: null,
				acId: null,
				details: {},
			}) + "\n");

			const removed = pruneSessionLog(tmpDir, 7, new Date("2026-07-25T12:00:00.000Z"));
			expect(removed).toEqual([oldFile]);
			expect(existsSync(oldFile)).toBe(false);
			expect(existsSync(recentFile)).toBe(true);
		});
	});

	describe("preservation (MAX_ENTRIES cap)", () => {
		it("should cap entries at MAX_ENTRIES on save", () => {
			const manyEntries = Array.from({ length: 2010 }, (_, i) => ({
				id: `log-test-${i}`,
				timestamp: new Date().toISOString(),
				action: "manual" as const,
				description: `Bulk entry ${i}`,
				itemId: null,
				acId: null,
				details: {} as Record<string, unknown>,
			}));
			saveSessionLog(tmpDir, { schemaVersion: 1, entries: manyEntries });
			const log = loadSessionLog(tmpDir);
			expect(log.entries.length).toBe(2000);
			expect(log.entries[0].description).toBe("Bulk entry 10");
		});
	});

	describe("performance", () => {
		it("writes 10K entries in under 1500ms", () => {
			const start = performance.now();
			for (let i = 0; i < 10000; i++) {
				logEntry(tmpDir, "manual", `Entry ${i}`);
			}
			const elapsed = performance.now() - start;
			expect(elapsed).toBeLessThan(1500);
		});
	});
});
