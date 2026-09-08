import { readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";
import { createAgent, deleteAgent, listAgents, updateAgent } from "../../agents/service.js";
import type { AgentIdentity } from "@letra/types";

export function createAgentRoutes(dependencies: { loadWorkflow: (root: string) => any; broadcast?: () => void }): RouteHandler {
	return async (context) => {
		if (!context.path.startsWith("/api/agents")) return false;
		const root = context.workspaceRoot;
		try {
			if (context.path === "/api/agents" && context.method === "GET") { sendJson(context.res, 200, listAgents(root, dependencies.loadWorkflow(root))); return true; }
			if (context.path === "/api/agents" && context.method === "POST") {
				const agent = await readJson<AgentIdentity>(context.req); const result = createAgent(root, agent, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 201, result); return true;
			}
			const match = context.path.match(/^\/api\/agents\/([^/]+)$/); if (!match) return false;
			const id = decodeURIComponent(match[1]);
			if (context.method === "PATCH") { const patch = await readJson<Partial<AgentIdentity>>(context.req); const result = updateAgent(root, id, patch, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 200, result); return true; }
			if (context.method === "DELETE") { deleteAgent(root, id, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 200, { ok: true }); return true; }
			return false;
		} catch (error) { sendError(context.res, 400, (error as Error).message); return true; }
	};
}
