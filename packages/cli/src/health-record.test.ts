import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DiagnosticResult } from "./diagnostics/types.js";
import {
	ackEntry,
	dismissEntry,
	getActiveEntries,
	getSummary,
	loadHealthRecord,
	mergeScanResults,
	saveHealthRecord,
} from "./health-record.js";
import type { HealthEntry, HealthRecord } from "./health-record.js";

function makeResult(
	overrides: Partial<DiagnosticResult> & { id?: string; title: string },
): DiagnosticResult {
	return {
		id: overrides.id ?? "",
		type: overrides.type ?? "warning",
		title: overrides.title,
		description: overrides.description ?? "",
		certainty: overrides.certainty ?? 0.8,
		detector: overrides.detector ?? "test-detector",
	};
}

describe("health-record", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-health-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	describe("loadHealthRecord", () => {
		it("should return empty record when file does not exist", () => {
			const record = loadHealthRecord(tmpDir);
			expect(record.schemaVersion).toBe(1);
			expect(record.entries).toEqual([]);
		});

		it("should load existing record", () => {
			const dir = join(tmpDir, ".letra");
			mkdirSync(dir, { recursive: true });
			writeFileSync(
				join(dir, "health-record.json"),
				JSON.stringify({
					schemaVersion: 1,
					lastScanAt: "2025-01-01",
					entries: [{ id: "hr-001", status: "novo" }],
				}),
			);
			const record = loadHealthRecord(tmpDir);
			expect(record.entries).toHaveLength(1);
			expect(record.entries[0].id).toBe("hr-001");
		});

		it("should handle corrupt JSON gracefully", () => {
			const dir = join(tmpDir, ".letra");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "health-record.json"), "{invalid");
			const record = loadHealthRecord(tmpDir);
			expect(record.entries).toEqual([]);
		});
	});

	describe("saveHealthRecord", () => {
		it("should persist record to disk", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			saveHealthRecord(tmpDir, record);
			const filePath = join(tmpDir, ".letra", "health-record.json");
			expect(existsSync(filePath)).toBe(true);
			const loaded = loadHealthRecord(tmpDir);
			expect(loaded.schemaVersion).toBe(1);
		});
	});

	describe("mergeScanResults", () => {
		it("should add new entries from scan results", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [
				makeResult({ title: "Test Warning", type: "warning", detector: "detector-a" }),
			];
			mergeScanResults(record, results);
			expect(record.entries).toHaveLength(1);
			expect(record.entries[0].title).toBe("Test Warning");
			expect(record.entries[0].status).toBe("novo");
			expect(record.entries[0].severity).toBe("media");
		});

		it("should set severity alta for error type", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [
				makeResult({ title: "Error!", type: "error", detector: "detector-a" }),
			];
			mergeScanResults(record, results);
			expect(record.entries[0].severity).toBe("alta");
		});

		it("should set severity baixa for info type", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [makeResult({ title: "Info", type: "info", detector: "detector-a" })];
			mergeScanResults(record, results);
			expect(record.entries[0].severity).toBe("baixa");
		});

		it("should deduplicate by detector:title hash", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [makeResult({ title: "Same", detector: "detector-a" })];
			const merged = mergeScanResults(record, results);
			expect(merged.entries).toHaveLength(1);
			mergeScanResults(record, results);
			expect(record.entries).toHaveLength(1);
		});

		it("should resurrect resolved entry if still present", () => {
			const id = "test-id";
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [makeResult({ title: "Recurring", detector: "detector-a" })];
			mergeScanResults(record, results);
			const entry = record.entries[0];
			entry.status = "resolvido";
			entry.resolvedAt = new Date().toISOString();
			mergeScanResults(record, results);
			expect(entry.status).toBe("novo");
			expect(entry.resolvedAt).toBeNull();
		});

		it("should not resurrect dismissed entries", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [makeResult({ title: "Dismissed", detector: "detector-a" })];
			mergeScanResults(record, results);
			const entry = record.entries[0];
			entry.status = "descartado";
			entry.dismissedAt = new Date().toISOString();
			mergeScanResults(record, results);
			expect(entry.status).toBe("descartado");
		});

		it("should mark missing entries as resolved", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			const results = [makeResult({ title: "Gone", detector: "detector-a" })];
			mergeScanResults(record, results);
			expect(record.entries[0].status).toBe("novo");
			const empty: DiagnosticResult[] = [];
			mergeScanResults(record, empty);
			expect(record.entries[0].status).toBe("resolvido");
			expect(record.entries[0].resolvedAt).not.toBeNull();
		});
	});

	describe("ackEntry", () => {
		it("should mark entry as ciente", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			mergeScanResults(record, [makeResult({ title: "Test", detector: "t" })]);
			const id = record.entries[0].id;
			expect(ackEntry(record, id)).toBe(true);
			expect(record.entries[0].status).toBe("ciente");
			expect(record.entries[0].acknowledgedAt).not.toBeNull();
		});

		it("should return false for unknown id", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			expect(ackEntry(record, "unknown")).toBe(false);
		});
	});

	describe("dismissEntry", () => {
		it("should mark entry as descartado", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			mergeScanResults(record, [makeResult({ title: "Test", detector: "t" })]);
			const id = record.entries[0].id;
			expect(dismissEntry(record, id)).toBe(true);
			expect(record.entries[0].status).toBe("descartado");
			expect(record.entries[0].dismissedAt).not.toBeNull();
		});

		it("should store dismiss reason", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			mergeScanResults(record, [makeResult({ title: "Test", detector: "t" })]);
			const id = record.entries[0].id;
			dismissEntry(record, id, "false positive");
			expect(record.entries[0].dismissReason).toBe("false positive");
		});

		it("should return false for unknown id", () => {
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries: [] };
			expect(dismissEntry(record, "unknown")).toBe(false);
		});
	});

	describe("getActiveEntries", () => {
		it("should return novo and ciente entries only", () => {
			const entries: HealthEntry[] = [
				{
					id: "1",
					type: "warning",
					title: "A",
					status: "novo",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "2",
					type: "warning",
					title: "B",
					status: "ciente",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "3",
					type: "warning",
					title: "C",
					status: "resolvido",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: "",
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "4",
					type: "warning",
					title: "D",
					status: "descartado",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: "",
					dismissReason: null,
					acknowledgedAt: null,
				},
			];
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries };
			const active = getActiveEntries(record);
			expect(active).toHaveLength(2);
			expect(active.map((e) => e.id)).toEqual(["1", "2"]);
		});
	});

	describe("getSummary", () => {
		it("should return correct counts", () => {
			const entries: HealthEntry[] = [
				{
					id: "1",
					type: "warning",
					title: "A",
					status: "novo",
					severity: "alta",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "2",
					type: "warning",
					title: "B",
					status: "novo",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "3",
					type: "warning",
					title: "C",
					status: "ciente",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "4",
					type: "warning",
					title: "D",
					status: "resolvido",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: "",
					dismissedAt: null,
					dismissReason: null,
					acknowledgedAt: null,
				},
				{
					id: "5",
					type: "warning",
					title: "E",
					status: "descartado",
					severity: "media",
					source: "t",
					detectedAt: "",
					resolvedAt: null,
					dismissedAt: "",
					dismissReason: null,
					acknowledgedAt: null,
				},
			];
			const record: HealthRecord = { schemaVersion: 1, lastScanAt: "", entries };
			const summary = getSummary(record);
			expect(summary.novo).toBe(2);
			expect(summary.ciente).toBe(1);
			expect(summary.resolvido).toBe(1);
			expect(summary.descartado).toBe(1);
			expect(summary.alta).toBe(1);
		});
	});
});
