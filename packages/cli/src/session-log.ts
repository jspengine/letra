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
const MAX_ENTRIES = 500;

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

	if (log.entries.length > MAX_ENTRIES) {
		log.entries = log.entries.slice(log.entries.length - MAX_ENTRIES);
	}

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
}

export function queryLog(root: string, query?: LogQuery): LogEntry[] {
	const log = loadSessionLog(root);
	let entries = [...log.entries];

	if (query?.itemId) {
		entries = entries.filter((e) => e.itemId === query.itemId);
	}

	if (query?.action) {
		entries = entries.filter((e) => e.action === query.action);
	}

	if (query?.since) {
		const sinceDate = new Date(query.since).getTime();
		entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
	}

	entries.reverse();

	if (!query?.all) {
		const limit = query?.limit ?? 10;
		const offset = query?.offset ?? 0;
		entries = entries.slice(offset, offset + limit);
	}

	return entries;
}
