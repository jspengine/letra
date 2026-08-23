import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface HandoffRouteDependencies {
	getPendingHandoffs: (agentId?: string) => Array<{
		itemId: string;
		from: string;
		to: string;
		summary: string;
		evidence: string[];
		executorId?: string;
		timestamp: string;
		expiresAt: string;
	}>;
}

export function createHandoffRoutes(dependencies: HandoffRouteDependencies): RouteHandler {
	return async (context) => {
		if (context.method !== "GET") return false;

		if (context.path === "/api/handoff/pending") {
			const url = new URL(context.req.url || "/", `http://${context.req.headers.host || "localhost"}`);
			const agentId = url.searchParams.get("agent") || undefined;

			const handoffs = dependencies.getPendingHandoffs(agentId);

			sendJson(context.res, 200, {
				handoffs,
				count: handoffs.length,
			});
			return true;
		}

		return false;
	};
}
