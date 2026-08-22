import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getLetraDir } from "./workspace/resolver.js";

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
	| "session_end"
	| "agent_direction_read"
	| "agent_validation_run"
	| "agent_ac_completion_requested"
	| "agent_transition_requested"
	| "agent_operation_rejected";

export interface LogEntry {
	id: string;
	timestamp: string;
	action: string;
	description: string;
	itemId: string | null;
	acId: string | null;
	details: Record<string, unknown>;
	level?: LogLevel;
}

export interface SessionLog {
	schemaVersion: number;
	entries: LogEntry[];
}

const LOG_FILE = "session-log.json";
const LOG_DIR = "session-log";
const SCHEMA_VERSION = 1;
const WRITE_ATTEMPTS = 5;
const MAX_ENTRIES = 2000;
const RETRYABLE_WRITE_CODES = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES"]);
export type LogLevel = "info" | "debug";

let logCounter = 0;
let temporaryFileCounter = 0;
const ensuredDirectories = new Set<string>();
const appendFileDescriptors = new Map<string, number>();

function logPath(root: string): string {
	return join(getLetraDir(root), LOG_FILE);
}

function logDir(root: string): string {
	return join(getLetraDir(root), LOG_DIR);
}

function jsonlPathForDate(root: string, date = new Date()): string {
	const iso = date.toISOString();
	const year = iso.slice(0, 4);
	const month = iso.slice(5, 7);
	const day = iso.slice(8, 10);
	return join(logDir(root), year, month, `${day}.jsonl`);
}

function nextId(): string {
	logCounter++;
	const ts = Date.now().toString(36).slice(-4);
	return `log-${ts}-${logCounter.toString(36).padStart(3, "0")}`;
}

function normalizeLogEntry(entry: Partial<LogEntry>): LogEntry | null {
	if (
		typeof entry.id !== "string" ||
		typeof entry.timestamp !== "string" ||
		typeof entry.action !== "string" ||
		typeof entry.description !== "string"
	) {
		return null;
	}
	return {
		id: entry.id,
		timestamp: entry.timestamp,
		action: entry.action,
		description: entry.description,
		itemId: typeof entry.itemId === "string" ? entry.itemId : null,
		acId: typeof entry.acId === "string" ? entry.acId : null,
		details:
			typeof entry.details === "object" && entry.details !== null && !Array.isArray(entry.details)
				? entry.details
				: {},
		level: entry.level === "debug" ? "debug" : "info",
	};
}

function readLegacyEntries(root: string): LogEntry[] {
	const file = logPath(root);
	if (!existsSync(file)) return [];
	try {
		const raw = readFileSync(file, "utf-8");
		const log = JSON.parse(raw) as Partial<SessionLog>;
		if (!Array.isArray(log.entries)) return [];
		return log.entries
			.map((entry) => normalizeLogEntry(entry as Partial<LogEntry>))
			.filter((entry): entry is LogEntry => entry !== null);
	} catch {
		return [];
	}
}

function listJsonlFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listJsonlFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			files.push(fullPath);
		}
	}
	return files;
}

function readJsonlEntries(root: string): LogEntry[] {
	const entries: LogEntry[] = [];
	for (const file of listJsonlFiles(logDir(root))) {
		let raw = "";
		try {
			raw = readFileSync(file, "utf-8");
		} catch {
			continue;
		}
		for (const line of raw.split(/\r?\n/)) {
			if (!line.trim()) continue;
			try {
				const entry = normalizeLogEntry(JSON.parse(line) as Partial<LogEntry>);
				if (entry) entries.push(entry);
			} catch {
				continue;
			}
		}
	}
	return entries;
}

function ensureDirectory(dir: string): void {
	if (ensuredDirectories.has(dir)) return;
	mkdirSync(dir, { recursive: true });
	ensuredDirectories.add(dir);
}

function appendJsonlLine(file: string, line: string): void {
	const dir = dirname(file);
	ensureDirectory(dir);
	let fd = appendFileDescriptors.get(file);
	if (fd === undefined) {
		fd = openSync(file, "a");
		appendFileDescriptors.set(file, fd);
	}
	writeSync(fd, `${line}\n`);
}

function closeAppendDescriptor(file: string): void {
	const fd = appendFileDescriptors.get(file);
	if (fd === undefined) return;
	closeSync(fd);
	appendFileDescriptors.delete(file);
}

/** Fecha todos os descritores de arquivo de append abertos pelo session-log. */
export function closeSessionLogHandles(): void {
	for (const [, fd] of appendFileDescriptors) closeSync(fd);
	appendFileDescriptors.clear();
}

export function loadSessionLog(root: string): SessionLog {
	return {
		schemaVersion: SCHEMA_VERSION,
		entries: [...readLegacyEntries(root), ...readJsonlEntries(root)],
	};
}

export interface SessionLogWriteOptions {
	replaceFile?: (source: string, destination: string) => void;
	sleep?: (milliseconds: number) => void;
}

function sleepSync(milliseconds: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isRetryableWriteError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string" &&
		RETRYABLE_WRITE_CODES.has(error.code)
	);
}

function replaceWithRetry(
	source: string,
	destination: string,
	options: SessionLogWriteOptions,
): void {
	const replaceFile = options.replaceFile ?? renameSync;
	const sleep = options.sleep ?? sleepSync;
	for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
		try {
			replaceFile(source, destination);
			return;
		} catch (error) {
			if (!isRetryableWriteError(error) || attempt === WRITE_ATTEMPTS) throw error;
			sleep(20 * 2 ** (attempt - 1));
		}
	}
}

export function saveSessionLog(
	root: string,
	log: SessionLog,
	options: SessionLogWriteOptions = {},
): void {
	const dir = getLetraDir(root);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	if (log.entries.length > MAX_ENTRIES) {
		log.entries = log.entries.slice(-MAX_ENTRIES);
	}
	const destination = logPath(root);
	const temporaryFile = join(
		dir,
		`.${LOG_FILE}.${process.pid}.${++temporaryFileCounter}.tmp`,
	);
	try {
		writeFileSync(temporaryFile, JSON.stringify(log, null, 2), "utf-8");
		replaceWithRetry(temporaryFile, destination, options);
	} finally {
		if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
	}
}

export interface LogEntryOptions {
	itemId?: string;
	acId?: string;
	by?: string;
	spec?: string;
	details?: Record<string, unknown>;
	level?: LogLevel;
}

function inferLogLevel(action: string, options?: LogEntryOptions): LogLevel {
	if (options?.level) return options.level;
	if (action === "system" || options?.details?.systemAction === true) return "debug";
	return "info";
}

export function logEntry(
	root: string,
	action: string,
	description: string,
	options?: LogEntryOptions,
): LogEntry {
	const now = new Date();
	const entry: LogEntry = {
		id: nextId(),
		timestamp: now.toISOString(),
		action,
		description,
		itemId: options?.itemId ?? null,
		acId: options?.acId ?? null,
		details: options?.details ?? {},
		level: inferLogLevel(action, options),
	};
	const file = jsonlPathForDate(root, now);
	appendJsonlLine(file, JSON.stringify(entry));
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
	actor?: string;
	debug?: boolean;
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
	if (!query?.debug) entries = entries.filter((e) => e.level !== "debug");
	if (query?.itemId) entries = entries.filter((e) => e.itemId === query.itemId);
	if (query?.action) entries = entries.filter((e) => e.action === query.action);
	if (query?.spec) {
		const spec = query.spec.toLowerCase();
		entries = entries.filter((e) => {
			const specVal = typeof e.details?.spec === "string" ? e.details.spec : "";
			return specVal.toLowerCase() === spec;
		});
	}
	if (query?.actor) {
		const actor = query.actor.toLowerCase();
		entries = entries.filter((e) => {
			const by = typeof e.details?.by === "string" ? e.details.by : "";
			return by.toLowerCase() === actor;
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
	entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	return entries;
}

function _queryLog(allEntries: LogEntry[], query?: LogQuery): LogEntry[] {
	const entries = _applyFilters(allEntries, query);
	if (query?.all) return entries;
	const limit = query?.limit ?? 10;
	const offset = query?.offset ?? 0;
	return entries.slice(offset, offset + limit);
}

export function pruneSessionLog(root: string, keepDays: number, now = new Date()): string[] {
	if (!Number.isFinite(keepDays) || keepDays < 1) {
		throw new Error("--keep must be a positive number of days");
	}
	const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - keepDays + 1);
	const removed: string[] = [];
	for (const file of listJsonlFiles(logDir(root))) {
		const match = file.match(/session-log[\\/](\d{4})[\\/](\d{2})[\\/](\d{2})\.jsonl$/);
		if (!match) continue;
		const fileDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
		if (fileDay < cutoff) {
			closeAppendDescriptor(file);
			rmSync(file, { force: true });
			removed.push(file);
		}
	}
	return removed;
}
