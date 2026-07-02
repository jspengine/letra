import { describe, expect, it } from "vitest";
import type { LogEntry } from "../session-log.js";
import {
	normalizeEntry,
	normalizeEntries,
	buildAuditResponse,
	type OperationalAuditEvent,
} from "./normalizer.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
	return {
		id: "log-test-001",
		timestamp: "2026-07-02T12:00:00.000Z",
		action: "manual",
		description: "Test entry",
		itemId: null,
		acId: null,
		details: {},
		...overrides,
	};
}

describe("normalizeEntry", () => {
	it("should map a human entry correctly", () => {
		const entry = makeEntry({
			action: "manual",
			description: "Working on AC-001",
			itemId: "ITEM-1",
			acId: "AC-001",
		});
		const result = normalizeEntry(entry);
		expect(result.id).toBe("log-test-001");
		expect(result.kind).toBe("human");
		expect(result.actor.type).toBe("human");
		expect(result.actor.label).toBe("User");
		expect(result.subject?.type).toBe("item");
		expect(result.subject?.id).toBe("ITEM-1");
		expect(result.summary).toBe("Working on AC-001");
	});

	it("should map a system entry correctly", () => {
		const entry = makeEntry({
			action: "system",
			description: "automation:diagnostics-scan | completed | cause=Timer | effect=Sync",
			details: {
				systemAction: true,
				actionId: "diagnostics-scan",
				outcome: "completed",
				trigger: "interval",
				cause: "Timer do servidor",
				effect: "Sincroniza health-record",
			},
		});
		const result = normalizeEntry(entry);
		expect(result.kind).toBe("system");
		expect(result.actor.type).toBe("system");
		expect(result.source.surface).toBe("harness");
		expect(result.status).toBe("succeeded");
		expect(result.correlationId).toBe("diagnostics-scan");
		expect(result.summary).toBe("diagnostics-scan: completed");
	});

	it("should map an execution entry (ac_done)", () => {
		const entry = makeEntry({
			action: "ac_done",
			description: "AC-001 marked done",
			acId: "AC-001",
			itemId: "ITEM-1",
		});
		const result = normalizeEntry(entry);
		expect(result.kind).toBe("execution");
		expect(result.status).toBe("succeeded");
		expect(result.subject?.type).toBe("item");
	});

	it("should map a failed system entry", () => {
		const entry = makeEntry({
			action: "system",
			details: { systemAction: true, outcome: "failed", error: "Connection refused" },
		});
		const result = normalizeEntry(entry);
		expect(result.status).toBe("failed");
		expect(result.kind).toBe("system");
	});

	it("should preserve legacy fields", () => {
		const entry = makeEntry({ action: "validate", description: "Validating..." });
		const result = normalizeEntry(entry);
		expect(result.legacy).toBeDefined();
		expect(result.legacy!.action).toBe("validate");
	});

	it("should infer reason from details.cause", () => {
		const entry = makeEntry({
			action: "system",
			details: { systemAction: true, cause: "File changed" },
		});
		const result = normalizeEntry(entry);
		expect(result.reason).toBe("File changed");
	});

	it("should infer subject from details.spec", () => {
		const entry = makeEntry({
			action: "validate",
			details: { spec: "operational-audit" },
		});
		const result = normalizeEntry(entry);
		expect(result.subject?.type).toBe("spec");
		expect(result.subject?.id).toBe("operational-audit");
	});

	it("should map watcher-triggered system actions", () => {
		const entry = makeEntry({
			action: "system",
			details: { systemAction: true, actionId: "specs-watch", trigger: "watch" },
		});
		const result = normalizeEntry(entry);
		expect(result.source.surface).toBe("watcher");
	});
});

describe("normalizeEntries", () => {
	it("should normalize multiple entries", () => {
		const entries = [
			makeEntry({ action: "manual" }),
			makeEntry({ action: "system", id: "log-002", details: { systemAction: true } }),
		];
		const results = normalizeEntries(entries);
		expect(results).toHaveLength(2);
		expect(results[0].kind).toBe("human");
		expect(results[1].kind).toBe("system");
	});
});

describe("buildAuditResponse", () => {
	it("should build full response with facets", () => {
		const entries = [
			makeEntry({ action: "manual" }),
			makeEntry({ action: "system", details: { systemAction: true, outcome: "completed" } }),
			makeEntry({ action: "ac_done", itemId: "ITEM-1" }),
		];
		const response = buildAuditResponse(entries, 3, 1, 3);
		expect(response.items).toHaveLength(3);
		expect(response.entries).toHaveLength(3);
		expect(response.total).toBe(3);
		expect(response.page).toBe(1);
		expect(response.limit).toBe(3);
		expect(response.facets.kinds).toHaveProperty("human");
		expect(response.facets.kinds).toHaveProperty("system");
		expect(response.facets.kinds).toHaveProperty("execution");
	});

	it("should compute facet counts correctly", () => {
		const entries = [
			makeEntry({ action: "manual" }),
			makeEntry({ action: "manual" }),
			makeEntry({ action: "system", details: { systemAction: true } }),
		];
		const response = buildAuditResponse(entries, 3, 1, 3);
		expect(response.facets.actions.manual).toBe(2);
		expect(response.facets.actions.system).toBe(1);
	});
});

describe("contract compliance", () => {
	it("every normalized event should have required fields", () => {
		const entry = makeEntry();
		const result = normalizeEntry(entry);
		const required: (keyof OperationalAuditEvent)[] = [
			"id", "timestamp", "kind", "action", "status", "actor", "source", "summary", "details",
		];
		for (const field of required) {
			expect(result[field]).toBeDefined();
		}
	});

	it("should handle a real-world session-log entry", () => {
		const entry: LogEntry = {
			id: "log-zwme-180",
			timestamp: "2026-07-02T13:41:59.654Z",
			action: "system",
			description: "automation:specs-watch | triggered | cause=Mudança em `.letra/specs/**` | effect=Atualiza a visão derivada de specs e emite `workflow-updated`",
			itemId: null,
			acId: null,
			details: {
				systemAction: true,
				actionId: "specs-watch",
				outcome: "triggered",
				trigger: "watch",
				cadence: "sob mudança de arquivo",
				cause: "Mudança em `.letra/specs/**`",
				effect: "Atualiza a visão derivada de specs e emite `workflow-updated`",
				error: null,
				path: "C:\\Workspace\\letra\\.letra\\specs",
			},
		};
		const result = normalizeEntry(entry);
		expect(result.kind).toBe("system");
		expect(result.source.surface).toBe("watcher");
		expect(result.status).toBe("started");
		expect(result.correlationId).toBe("specs-watch");
		expect(result.actor.type).toBe("system");
		expect(result.summary).toBe("specs-watch: triggered");
		expect(result.legacy).toBeDefined();
	});
});
