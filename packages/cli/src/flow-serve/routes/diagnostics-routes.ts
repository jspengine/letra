import type { DiagnosticEngine } from "../../diagnostics/engine.js";
import type {
	ackEntry,
	dismissEntry,
	getActiveEntries,
	getSummary,
	loadHealthRecord,
	saveHealthRecord,
} from "../../health-record.js";
import type { runDiagnosticsAndSyncHealth, DiagnosticsOutput } from "../diagnostics.js";
import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface DiagnosticsRouteDependencies {
	engineFor: (workspaceRoot: string) => DiagnosticEngine;
	runDiagnostics: typeof runDiagnosticsAndSyncHealth;
	loadHealthRecord: typeof loadHealthRecord;
	saveHealthRecord: typeof saveHealthRecord;
	ackEntry: typeof ackEntry;
	dismissEntry: typeof dismissEntry;
	getSummary: typeof getSummary;
	getActiveEntries: typeof getActiveEntries;
	broadcast: () => void;
	broadcastDiagnostics: (output: DiagnosticsOutput) => void;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) {
		sendError(res, error.status, error.message);
		return;
	}
	sendError(res, 400, (error as Error).message);
}

export function createDiagnosticsRoutes(
	dependencies: DiagnosticsRouteDependencies,
): RouteHandler {
	return async ({ method, path, req, res, url, workspaceRoot }) => {
		const engine = dependencies.engineFor(workspaceRoot);

		if (path === "/api/diagnostics" && method === "GET") {
			sendJson(res, 200, engine.getLastOutput());
			return true;
		}
		if (path === "/api/diagnostics/snapshots" && method === "GET") {
			let snapshots = engine.listSnapshots();
			const total = snapshots.length;
			const limitParam = url.searchParams.get("limit");
			const offsetParam = url.searchParams.get("offset");
			if (limitParam === null && offsetParam === null) {
				sendJson(res, 200, { snapshots });
				return true;
			}
			const limit = limitParam ? parseInt(limitParam, 10) : total;
			const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
			snapshots = snapshots.slice(offset, offset + limit);
			sendJson(res, 200, { snapshots, total, limit, offset });
			return true;
		}
		if (path === "/api/diagnostics/scan" && method === "POST") {
			try {
				const output = await dependencies.runDiagnostics(engine, workspaceRoot);
				dependencies.broadcastDiagnostics(output);
				sendJson(res, 200, output);
			} catch (error) {
				sendError(res, 500, (error as Error).message);
			}
			return true;
		}

		const undoMatch = path.match(/^\/api\/diagnostics\/undo\/(.+)$/);
		if (undoMatch && method === "POST") {
			try {
				const result = await engine.undo(decodeURIComponent(undoMatch[1]));
				if (!result.ok) sendError(res, 404, "Snapshot not found");
				else {
					dependencies.broadcast();
					sendJson(res, 200, result);
				}
			} catch (error) {
				sendError(res, 500, (error as Error).message);
			}
			return true;
		}

		const redoMatch = path.match(/^\/api\/diagnostics\/redo\/(.+)$/);
		if (redoMatch && method === "POST") {
			try {
				const result = await engine.redo(decodeURIComponent(redoMatch[1]));
				if (!result.ok) sendError(res, 404, "Snapshot not found");
				else {
					dependencies.broadcast();
					sendJson(res, 200, result);
				}
			} catch (error) {
				sendError(res, 500, (error as Error).message);
			}
			return true;
		}

		if (path === "/api/health" && method === "GET") {
			const record = dependencies.loadHealthRecord(workspaceRoot);
			sendJson(res, 200, {
				summary: dependencies.getSummary(record),
				entries: record.entries,
				active: dependencies.getActiveEntries(record),
			});
			return true;
		}
		if (path === "/api/health/alerts" && method === "GET") {
			const record = dependencies.loadHealthRecord(workspaceRoot);
			sendJson(res, 200, record.entries.filter((entry) => entry.status === "novo"));
			return true;
		}
		if (path === "/api/health/scan" && method === "POST") {
			try {
				const output = await dependencies.runDiagnostics(engine, workspaceRoot);
				dependencies.broadcastDiagnostics(output);
				sendJson(res, 200, {
					fixes: output.fixes.length,
					suggestions: output.suggestions.length,
				});
			} catch (error) {
				sendError(res, 500, (error as Error).message);
			}
			return true;
		}
		if (path === "/api/health/ack" && method === "POST") {
			try {
				const { id } = await readJson<{ id: string }>(req);
				const record = dependencies.loadHealthRecord(workspaceRoot);
				if (!dependencies.ackEntry(record, id)) sendError(res, 404, "Entry not found");
				else {
					dependencies.saveHealthRecord(workspaceRoot, record);
					dependencies.broadcast();
					sendJson(res, 200, { acked: id });
				}
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/health/dismiss" && method === "POST") {
			try {
				const { id, reason } = await readJson<{ id: string; reason?: string }>(req);
				const record = dependencies.loadHealthRecord(workspaceRoot);
				if (!dependencies.dismissEntry(record, id, reason)) {
					sendError(res, 404, "Entry not found");
				} else {
					dependencies.saveHealthRecord(workspaceRoot, record);
					dependencies.broadcast();
					sendJson(res, 200, { dismissed: id });
				}
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		return false;
	};
}
