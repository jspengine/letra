import type { LogEntry } from "../session-log.js";

export type EventKind = "flow" | "execution" | "human" | "system";
export type EventStatus = "started" | "succeeded" | "failed" | "blocked" | "requested" | "info";
export type Surface = "cli" | "web" | "watcher" | "harness";
export type SubjectType = "workspace" | "item" | "spec" | "ac" | "gate" | "execution" | "artifact";

export interface OperationalAuditEvent {
	id: string;
	timestamp: string;
	kind: EventKind;
	action: string;
	status: EventStatus;
	actor: {
		type: "human" | "agent" | "system";
		id?: string;
		label: string;
	};
	source: {
		surface: Surface;
		command?: string;
	};
	subject?: {
		type: SubjectType;
		id: string;
		label?: string;
	};
	summary: string;
	reason?: string;
	correlationId?: string;
	details: Record<string, unknown>;
	legacy?: Record<string, unknown>;
}

export interface AuditQueryResponse {
	items: OperationalAuditEvent[];
	entries: LogEntry[];
	total: number;
	page: number;
	limit: number;
	facets: {
		kinds: Record<string, number>;
		statuses: Record<string, number>;
		sources: Record<string, number>;
		actions: Record<string, number>;
	};
}

function inferKind(entry: LogEntry): EventKind {
	if (entry.action === "system") return "system";
	if (entry.action === "manual") return "human";
	if (entry.action === "ac_done" || entry.action === "ac_complete") return "execution";
	if (entry.action === "validate" || entry.action === "diagnose") return "execution";
	if (entry.action === "health_scan" || entry.action === "health_ack" || entry.action === "health_dismiss") return "system";
	return "flow";
}

function inferStatus(entry: LogEntry): EventStatus {
	const action = entry.action;
	const outcome = entry.details?.outcome;
	if (outcome === "failed" || outcome === "error") return "failed";
	if (outcome === "triggered" || outcome === "started") return "started";
	if (outcome === "armed") return "started";
	if (outcome === "completed") return "succeeded";
	if (action === "ac_done" || action === "item_move" || action === "item_release") return "succeeded";
	if (action === "validate" || action === "diagnose" || action === "health_scan") return "succeeded";
	if (action === "decision" || action === "sitrep") return "succeeded";
	if (action === "focus_set" || action === "focus_sync" || action === "focus_clear") return "succeeded";
	if (action === "session_end") return "succeeded";
	if (action === "manual") return "succeeded";
	if (action === "health_ack" || action === "health_dismiss") return "succeeded";
	return "info";
}

function inferActor(entry: LogEntry): OperationalAuditEvent["actor"] {
	if (entry.action === "system") return { type: "system", label: "automation" };
	if (entry.action === "manual") return { type: "human", label: "User" };
	const by = entry.details?.by;
	if (typeof by === "string") return { type: "human", label: by };
	if (entry.details?.systemAction) return { type: "system", label: "automation" };
	return { type: "system", label: "Letra" };
}

function inferSource(entry: LogEntry): OperationalAuditEvent["source"] {
	const trigger = entry.details?.trigger;
	if (entry.action === "system") {
		if (trigger === "watch") return { surface: "watcher" };
		if (trigger === "interval") return { surface: "harness" };
		return { surface: "harness" };
	}
	if (entry.action === "manual") return { surface: "cli" };
	return { surface: "harness" };
}

function inferSubject(entry: LogEntry): OperationalAuditEvent["subject"] | undefined {
	if (entry.itemId) return { type: "item", id: entry.itemId };
	if (entry.acId) return { type: "ac", id: entry.acId };
	const specVal = entry.details?.spec;
	if (typeof specVal === "string") return { type: "spec", id: specVal };
	return undefined;
}

function buildSummary(entry: LogEntry): string {
	const desc = entry.description;
	const actionId = entry.details?.actionId;
	const outcome = entry.details?.outcome;
	if (typeof actionId === "string" && typeof outcome === "string") {
		const label = actionId;
		return `${label}: ${outcome}`;
	}
	return desc.split("|")[0]?.trim() || desc;
}

function inferReason(entry: LogEntry): string | undefined {
	const reason = entry.details?.reason;
	if (typeof reason === "string") return reason;
	const cause = entry.details?.cause;
	if (typeof cause === "string") return cause;
	return undefined;
}

function inferCorrelationId(entry: LogEntry): string | undefined {
	const actionId = entry.details?.actionId;
	if (typeof actionId === "string") return actionId;
	const runId = entry.details?.runId;
	if (typeof runId === "string") return runId;
	const corrId = entry.details?.correlationId;
	if (typeof corrId === "string") return corrId;
	return undefined;
}

export function normalizeEntry(entry: LogEntry): OperationalAuditEvent {
	return {
		id: entry.id,
		timestamp: entry.timestamp,
		kind: inferKind(entry),
		action: entry.action,
		status: inferStatus(entry),
		actor: inferActor(entry),
		source: inferSource(entry),
		subject: inferSubject(entry),
		summary: buildSummary(entry),
		reason: inferReason(entry),
		correlationId: inferCorrelationId(entry),
		details: { ...entry.details },
		legacy: { ...entry },
	};
}

export function normalizeEntries(entries: LogEntry[]): OperationalAuditEvent[] {
	return entries.map(normalizeEntry);
}

export function buildAuditResponse(
	entries: LogEntry[],
	total: number,
	page: number,
	limit: number,
): AuditQueryResponse {
	const items = normalizeEntries(entries);
	const kinds: Record<string, number> = {};
	const statuses: Record<string, number> = {};
	const sources: Record<string, number> = {};
	const actions: Record<string, number> = {};

	for (const item of items) {
		kinds[item.kind] = (kinds[item.kind] || 0) + 1;
		statuses[item.status] = (statuses[item.status] || 0) + 1;
		sources[item.source.surface] = (sources[item.source.surface] || 0) + 1;
		actions[item.action] = (actions[item.action] || 0) + 1;
	}

	return {
		items,
		entries,
		total,
		page,
		limit,
		facets: { kinds, statuses, sources, actions },
	};
}
