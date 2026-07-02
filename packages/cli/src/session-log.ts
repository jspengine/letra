import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type LogAction =
	| "validate"
	| "diagnose"
	| "health_scan"
	| "health_ack"
	| "health_dismiss"
	| "ac_complete"
	| "ac_done"
	| "item_move"
	| "item_claim"
	| "item_release"
	| "decision"
	| "sitrep"
	| "focus_set"
	| "focus_sync"
	| "focus_clear"
	| "manual"
	| "system"
	| "session_end";

export interface LogEntry {
	id: string;
	timestamp: string;
	action: LogAction;
	description: string;
	itemId: string | null;
	acId: string | null;
	details: Record<string, unknown>;
}

export interface SessionLog {
	schemaVersion: number;
	entries: LogEntry[];
}

const LOG_FILE = "session-log.json";
const SCHEMA_VERSION = 1;

let logCounter = 0;

function logPath(root: string): string {
	return join(root, ".letra", LOG_FILE);
}

function nextId(): string {
	logCounter++;
	const ts = Date.now().toString(36).slice(-4);
	return `log-${ts}-${logCounter.toString(36).padStart(3, "0")}`;
}

export function loadSessionLog(root: string): SessionLog {
	const file = logPath(root);
	if (!existsSync(file)) {
		return { schemaVersion: SCHEMA_VERSION, entries: [] };
	}
	try {
		const raw = readFileSync(file, "utf-8");
		const log = JSON.parse(raw) as SessionLog;
		if (!log.entries) log.entries = [];
		return log;
	} catch {
		return { schemaVersion: SCHEMA_VERSION, entries: [] };
	}
}

export function saveSessionLog(root: string, log: SessionLog): void {
	const dir = join(root, ".letra");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(logPath(root), JSON.stringify(log, null, 2), "utf-8");
}

export interface LogEntryOptions {
	itemId?: string;
	acId?: string;
	by?: string;
	spec?: string;
	details?: Record<string, unknown>;
}

export function logEntry(
	root: string,
	action: LogAction,
	description: string,
	options?: LogEntryOptions,
): LogEntry {
	const log = loadSessionLog(root);
	const entry: LogEntry = {
		id: nextId(),
		timestamp: new Date().toISOString(),
		action,
		description,
		itemId: options?.itemId ?? null,
		acId: options?.acId ?? null,
		details: options?.details ?? {},
	};
	log.entries.push(entry);
	saveSessionLog(root, log);
	return entry;
}

export interface LogQuery {
	limit?: number;
	offset?: number;
	itemId?: string;
	action?: LogAction | string;
	since?: string;
	all?: boolean;
	q?: string;
	from?: string;
	to?: string;
	spec?: string;
}

export interface LogQueryResult {
	entries: LogEntry[];
	total: number;
	facets: {
		actions: Record<string, number>;
		statuses: Record<string, number>;
	};
}

function matchesTextSearch(entry: LogEntry, query: string): boolean {
	const lower = query.toLowerCase();
	return (
		entry.id.toLowerCase().includes(lower) ||
		entry.action.toLowerCase().includes(lower) ||
		entry.description.toLowerCase().includes(lower) ||
		(entry.itemId ?? "").toLowerCase().includes(lower) ||
		(entry.acId ?? "").toLowerCase().includes(lower) ||
		JSON.stringify(entry.details).toLowerCase().includes(lower)
	);
}

function computeFacets(entries: LogEntry[]): LogQueryResult["facets"] {
	const actions: Record<string, number> = {};
	const statuses: Record<string, number> = {};
	for (const e of entries) {
		const action = e.action || "unknown";
		actions[action] = (actions[action] || 0) + 1;
		const outcome = typeof e.details?.outcome === "string" ? e.details.outcome : "completed";
		statuses[outcome] = (statuses[outcome] || 0) + 1;
	}
	return { actions, statuses };
}

export function queryLog(root: string, query?: LogQuery): LogEntry[] {
	const log = loadSessionLog(root);
	return _queryLog(log.entries, query);
}

export function queryLogWithMeta(root: string, query?: LogQuery): LogQueryResult {
	const log = loadSessionLog(root);
	const allEntries = _applyFilters(log.entries, query);
	const total = allEntries.length;
	const limit = query?.limit ?? 50;
	const offset = query?.offset ?? 0;
	const page = query?.all ? allEntries : allEntries.slice(offset, offset + limit);
	return {
		entries: page,
		total,
		facets: computeFacets(allEntries),
	};
}

function _applyFilters(allEntries: LogEntry[], query?: LogQuery): LogEntry[] {
	let entries = [...allEntries];
	if (query?.itemId) entries = entries.filter((e) => e.itemId === query.itemId);
	if (query?.action) entries = entries.filter((e) => e.action === query.action);
	if (query?.spec) {
		const spec = query.spec.toLowerCase();
		entries = entries.filter((e) => {
			const specVal = typeof e.details?.spec === "string" ? e.details.spec : "";
			return specVal.toLowerCase() === spec;
		});
	}
	if (query?.q) entries = entries.filter((e) => matchesTextSearch(e, query.q!));
	if (query?.since) {
		const sinceDate = new Date(query.since).getTime();
		entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
	}
	if (query?.from) {
		const fromDate = new Date(query.from).getTime();
		entries = entries.filter((e) => new Date(e.timestamp).getTime() >= fromDate);
	}
	if (query?.to) {
		const toDate = new Date(query.to).getTime();
		entries = entries.filter((e) => new Date(e.timestamp).getTime() <= toDate);
	}
	entries.reverse();
	return entries;
}

function _queryLog(allEntries: LogEntry[], query?: LogQuery): LogEntry[] {
	const entries = _applyFilters(allEntries, query);
	if (query?.all) return entries;
	const limit = query?.limit ?? 10;
	const offset = query?.offset ?? 0;
	return entries.slice(offset, offset + limit);
}
