import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DiagnosticResult } from "./diagnostics/types.js";
import { getLetraDir } from "./workspace/resolver.js";

export type HealthStatus = "novo" | "ciente" | "descartado" | "resolvido";

export interface HealthEntry {
	id: string;
	type: string;
	title: string;
	status: HealthStatus;
	severity: "baixa" | "media" | "alta";
	source: string;
	detectedAt: string;
	resolvedAt: string | null;
	dismissedAt: string | null;
	dismissReason: string | null;
	acknowledgedAt: string | null;
}

export interface HealthRecord {
	schemaVersion: number;
	lastScanAt: string;
	entries: HealthEntry[];
}

const RECORD_FILE = "health-record.json";
const SCHEMA_VERSION = 1;
const CLEANUP_DAYS = 90;

function recordPath(root: string): string {
	return join(getLetraDir(root), RECORD_FILE);
}

export function loadHealthRecord(root: string): HealthRecord {
	const file = recordPath(root);
	if (!existsSync(file)) {
		return { schemaVersion: SCHEMA_VERSION, lastScanAt: new Date().toISOString(), entries: [] };
	}
	try {
		const raw = readFileSync(file, "utf-8");
		const record = JSON.parse(raw) as HealthRecord;
		if (!record.entries) record.entries = [];
		return record;
	} catch {
		return { schemaVersion: SCHEMA_VERSION, lastScanAt: new Date().toISOString(), entries: [] };
	}
}

export function saveHealthRecord(root: string, record: HealthRecord): void {
	const dir = getLetraDir(root);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	record.lastScanAt = new Date().toISOString();
	writeFileSync(recordPath(root), JSON.stringify(record, null, 2), "utf-8");
}

function hashResult(result: DiagnosticResult): string {
	const key = `${result.detector}:${result.title}`;
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		const char = key.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0;
	}
	return `hr-${Math.abs(hash).toString(16).padStart(6, "0")}`;
}

function severityFromType(type: string): HealthEntry["severity"] {
	if (type === "error") return "alta";
	if (type === "warning") return "media";
	return "baixa";
}

export function mergeScanResults(record: HealthRecord, results: DiagnosticResult[]): HealthRecord {
	const now = new Date().toISOString();

	for (const result of results) {
		const id = hashResult(result);
		const existing = record.entries.find((e) => e.id === id);

		if (!existing) {
			record.entries.push({
				id,
				type: result.type,
				title: result.title,
				status: "novo",
				severity: severityFromType(result.type),
				source: result.detector,
				detectedAt: now,
				resolvedAt: null,
				dismissedAt: null,
				dismissReason: null,
				acknowledgedAt: null,
			});
		} else if (existing.status === "resolvido") {
			existing.status = "novo";
			existing.detectedAt = now;
			existing.resolvedAt = null;
		}
	}

	for (const entry of record.entries) {
		if (entry.status === "descartado") continue;
		const stillPresent = results.some((r) => hashResult(r) === entry.id);
		if (!stillPresent && entry.status !== "resolvido") {
			entry.status = "resolvido";
			entry.resolvedAt = now;
		}
	}

	record.entries = cleanupOldEntries(record.entries);

	return record;
}

function cleanupOldEntries(entries: HealthEntry[]): HealthEntry[] {
	const cutoff = Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000;
	return entries.filter((e) => {
		if (e.status !== "resolvido" && e.status !== "descartado") return true;
		const refDate = e.resolvedAt ?? e.dismissedAt ?? e.detectedAt;
		return new Date(refDate).getTime() > cutoff;
	});
}

export function ackEntry(record: HealthRecord, id: string): boolean {
	const entry = record.entries.find((e) => e.id === id);
	if (!entry) return false;
	entry.status = "ciente";
	entry.acknowledgedAt = new Date().toISOString();
	return true;
}

export function dismissEntry(record: HealthRecord, id: string, reason?: string): boolean {
	const entry = record.entries.find((e) => e.id === id);
	if (!entry) return false;
	entry.status = "descartado";
	entry.dismissedAt = new Date().toISOString();
	entry.dismissReason = reason ?? null;
	return true;
}

export function getActiveEntries(record: HealthRecord): HealthEntry[] {
	return record.entries.filter((e) => e.status === "novo" || e.status === "ciente");
}

export function getSummary(record: HealthRecord): {
	novo: number;
	ciente: number;
	descartado: number;
	resolvido: number;
	alta: number;
} {
	return {
		novo: record.entries.filter((e) => e.status === "novo").length,
		ciente: record.entries.filter((e) => e.status === "ciente").length,
		descartado: record.entries.filter((e) => e.status === "descartado").length,
		resolvido: record.entries.filter((e) => e.status === "resolvido").length,
		alta: record.entries.filter((e) => e.status === "novo" && e.severity === "alta").length,
	};
}
