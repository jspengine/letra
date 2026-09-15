import { readFileSync, existsSync } from "node:fs";
import { securityReportPath } from "../../security/scoped-review.js";
import { loadWorkflow } from "../../commands/flow-init.js";
import { resolveAgentDirection } from "../../agent-direction/service.js";
import { runSecurityReviewOperation } from "../../domain-operations/service.js";
import { HttpBodyError, readJson, routeParam, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

function sendSecurityError(res: import("node:http").ServerResponse, status: number, reasonCode: string, reason: string, evidence: string[] = []): void {
	sendJson(res, status, { outcome: "rejected", auditId: "http-error", beforeRevision: "", afterRevision: "", reasonCode, reason, evidence });
}

export function createSecurityReviewRoutes(): RouteHandler {
	return async ({ method, path, req, res, workspaceRoot }) => {
		const itemId = routeParam(path, "/api/items/:id/security-review");
		if (itemId === null) return false;
		const workflow = loadWorkflow(workspaceRoot);
		const item = workflow?.items.find((candidate) => candidate.id === itemId);
		if (!item) { sendSecurityError(res, 404, "ITEM_NOT_FOUND", "Item not found"); return true; }
		if (method === "GET") {
			const pathToReport = securityReportPath(workspaceRoot, itemId);
			let report = item.securityReview;
			if (!report && existsSync(pathToReport)) {
				try { report = JSON.parse(readFileSync(pathToReport, "utf8")); } catch { report = undefined; }
			}
			sendJson(res, 200, report ?? { reasonCode: "SECURITY_REVIEW_REQUIRED", itemId });
			return true;
		}
		if (method !== "POST") { sendSecurityError(res, 405, "SECURITY_METHOD_NOT_ALLOWED", "Method not allowed"); return true; }
		try {
			const data = await readJson<{ executorId?: string; expectedRevision?: string; reason?: string; actor?: string; idempotencyKey?: string }>(req);
			const result = await runSecurityReviewOperation(workspaceRoot, {
				itemId,
				executorId: data.executorId ?? "opencode",
				expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
				reason: data.reason?.trim() || "Revisão de Security solicitada pela UI.",
				actor: data.actor ?? "security",
				idempotencyKey: data.idempotencyKey,
			});
			if (result.outcome === "rejected") {
				const evidence = result.securityReview?.findings.flatMap((finding) => finding.evidence) ?? [];
				sendJson(res, result.reasonCode === "DIRECTION_STALE" ? 409 : 422, { ...result, evidence });
				return true;
			}
			sendJson(res, 200, result);
		} catch (error) {
			if (error instanceof HttpBodyError) sendSecurityError(res, error.status, "SECURITY_REQUEST_INVALID", error.message);
			else sendSecurityError(res, 400, "SECURITY_REQUEST_INVALID", (error as Error).message);
		}
		return true;
	};
}
