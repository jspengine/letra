import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSessionLog, logEntry, queryLog } from "./session-log.js";
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
			expect(entry.id).toMatch(/^log-/);
		});

		it("should persist log to disk", () => {
			logEntry(tmpDir, "manual", "Persist test");
			const log = loadSessionLog(tmpDir);
			expect(log.entries).toHaveLength(1);
			expect(log.entries[0].description).toBe("Persist test");
		});

		it("should handle all action types", () => {
			const actions = [
				"validate", "diagnose", "health_scan", "health_ack", "health_dismiss",
				"ac_complete", "ac_done", "item_move", "decision", "sitrep", "focus_set", "manual", "session_end",
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

		it("should enforce FIFO limit of 500 entries", () => {
			for (let i = 0; i < 510; i++) {
				logEntry(tmpDir, "manual", `Entry ${i}`);
			}
			const log = loadSessionLog(tmpDir);
			expect(log.entries.length).toBeLessThanOrEqual(500);
			expect(log.entries[0].description).toBe("Entry 10");
			expect(log.entries[log.entries.length - 1].description).toBe("Entry 509");
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
});
