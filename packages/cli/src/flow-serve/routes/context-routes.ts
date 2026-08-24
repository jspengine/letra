import type { clearFocusFile, writeFocusFile } from "../../adapters/focus-sync.js";
import type { pulse } from "../../commands/pulse.js";
import type { sitrep } from "../../commands/sitrep.js";
import type { logEntry, queryLog, queryLogWithMeta } from "../../session-log.js";
import { buildAuditResponse } from "../../operational-audit/normalizer.js";
import type {
	buildRequestedActivityContext,
	contextFileExists,
	readDecisions,
	readFocusDocument,
	readFocusState,
} from "../context.js";
import type { readAllowedContextFile } from "../specs.js";
import type { getRecurringSystemActions } from "../system-actions.js";
import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface ContextRouteDependencies {
	clearFocusFile: typeof clearFocusFile;
	writeFocusFile: typeof writeFocusFile;
	logEntry: typeof logEntry;
	queryLog: typeof queryLog;
	queryLogWithMeta: typeof queryLogWithMeta;
	readFocusState: typeof readFocusState;
	readFocusDocument: typeof readFocusDocument;
	readDecisions: typeof readDecisions;
	readAllowedContextFile: typeof readAllowedContextFile;
	contextFileExists: typeof contextFileExists;
	getRecurringSystemActions: typeof getRecurringSystemActions;
	sitrep: typeof sitrep;
	pulse: typeof pulse;
	buildActivityContext: typeof buildRequestedActivityContext;
	broadcast: () => void;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) sendError(res, error.status, error.message);
	else sendError(res, 400, (error as Error).message);
}

export function createContextRoutes(dependencies: ContextRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, url, workspaceRoot, workspaceDir }) => {
		if (path === "/api/focus") {
			if (method === "DELETE") {
				dependencies.clearFocusFile(workspaceRoot);
				dependencies.logEntry(workspaceRoot, "focus_clear", "Focus cleared via UI");
				dependencies.broadcast();
				sendJson(res, 200, { active: false });
				return true;
			}
			if (method === "POST") {
				try {
					const data = await readJson<{ spec?: string; itemId?: string }>(req);
					const spec = data.spec || "unknown";
					const itemId = data.itemId || "";
					dependencies.writeFocusFile(workspaceRoot, spec, itemId);
					dependencies.logEntry(workspaceRoot, "focus_set", `Focus set via UI: ${spec}`, {
						itemId,
					});
					dependencies.broadcast();
					sendJson(res, 200, { active: true, spec, itemId });
				} catch (error) {
					sendBodyError(error, res);
				}
				return true;
			}
			const state = dependencies.readFocusState(workspaceDir);
			const content = dependencies.readFocusDocument(workspaceDir);
			sendJson(
				res,
				200,
				state.active ? { ...state, content: content ?? "" } : { active: false },
			);
			return true;
		}

		if (path === "/api/context") {
			const file = url.searchParams.get("file") || "context.md";
			if (file === "decisions") {
				sendJson(res, 200, dependencies.readDecisions(workspaceDir));
				return true;
			}
			const content = dependencies.readAllowedContextFile(workspaceDir, file);
			if (content === null) {
				sendError(
					res,
					dependencies.contextFileExists(workspaceDir, file) ? 400 : 404,
					dependencies.contextFileExists(workspaceDir, file)
						? `Invalid file: ${file}`
						: `File not found: ${file}`,
				);
				return true;
			}
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end(content);
			return true;
		}

		if (path === "/api/log" && method === "GET") {
			const rawLimit = url.searchParams.get("limit");
			const rawPage = url.searchParams.get("page");
			const page = rawPage ? Math.max(1, Number.parseInt(rawPage, 10)) : 1;
			const limit = rawLimit ? Math.max(1, Math.min(500, Number.parseInt(rawLimit, 10))) : 50;
			const offset = (page - 1) * limit;
			const result = dependencies.queryLogWithMeta(workspaceRoot, {
				all: url.searchParams.get("all") === "true",
				itemId: url.searchParams.get("item") ?? undefined,
				action: url.searchParams.get("action") ?? undefined,
				since: url.searchParams.get("since") ?? undefined,
				q: url.searchParams.get("q") ?? undefined,
				from: url.searchParams.get("from") ?? undefined,
				to: url.searchParams.get("to") ?? undefined,
				spec: url.searchParams.get("spec") ?? undefined,
				actor: url.searchParams.get("actor") ?? undefined,
				debug: url.searchParams.get("debug") === "true",
				limit,
				offset,
			});
			const response = buildAuditResponse(result.entries, result.total, page, limit);
			sendJson(res, 200, response);
			return true;
		}
		if (path === "/api/harness-viewer" && method === "GET") {
			try {
				const { existsSync, readFileSync } = await import("node:fs");
				const { join } = await import("node:path");
				const { readFocusFile } = await import("../../adapters/focus-sync.js");
				const { loadSessionLog } = await import("../../session-log.js");
				const { loadHealthRecord, getActiveEntries } = await import(
					"../../health-record.js"
				);

				function readFile(relativePath: string): string {
					const fp = join(workspaceDir, relativePath);
					if (!existsSync(fp)) return "";
					try {
						return readFileSync(fp, "utf-8");
					} catch {
						return "";
					}
				}

				const l1Files = [
					"constitution.md",
					"context.md",
					"glossary.md",
					"constraints.md",
				] as const;
				const l1 = l1Files.map((f) => ({
					path: `.letra/${f}`,
					content: readFile(f),
				}));

				const focus = readFocusFile(workspaceRoot);
				const focusContent = readFile("focus.md");
				const specContent = focus?.specName
					? readFile(`specs/${focus.specName}/spec.md`)
					: "";
				const l2 = {
					focus: focus ? { ...focus, content: focusContent } : null,
					spec: specContent
						? { path: `.letra/specs/${focus?.specName}/spec.md`, content: specContent }
						: null,
				};

				const healthRecord = loadHealthRecord(workspaceRoot);
				const alerts = getActiveEntries(healthRecord);
				const log = loadSessionLog(workspaceRoot);
				const l3 = {
					alerts: alerts.slice(0, 10),
					alertCount: alerts.length,
					sessionEventCount: log.entries?.length ?? 0,
				};

				const l4 = {
					constraintsContent: readFile("constraints.md"),
					glossaryContent: readFile("glossary.md"),
				};

				sendJson(res, 200, { layers: { l1, l2, l3, l4 } });
			} catch (error) {
				sendError(res, 500, (error as Error).message);
			}
			return true;
		}
		if (path === "/api/system-actions" && method === "GET") {
			sendJson(res, 200, { actions: dependencies.getRecurringSystemActions(workspaceRoot) });
			return true;
		}
		if (path === "/api/sitrep" && method === "POST") {
			await dependencies.sitrep(workspaceRoot, {
				dryRun: url.searchParams.get("dryRun") === "true",
			});
			sendJson(res, 200, { ok: true });
			return true;
		}
		if (path === "/api/pulse" && method === "GET") {
			sendJson(res, 200, await dependencies.pulse(workspaceRoot, { json: false }));
			return true;
		}
		if (path === "/api/activity-context" && method === "GET") {
			sendJson(
				res,
				200,
				dependencies.buildActivityContext(workspaceRoot, url.searchParams.get("activity")),
			);
			return true;
		}
		return false;
	};
}
