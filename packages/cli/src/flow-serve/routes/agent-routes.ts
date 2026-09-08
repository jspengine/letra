import { readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";
import { createAgent, deleteAgent, listAgents, updateAgent } from "../../agents/service.js";
import type { AgentIdentity } from "@letra/types";

let agentMutation = false;
async function acquireAgentMutation(): Promise<() => void> { while (agentMutation) await new Promise((resolve) => setTimeout(resolve, 0)); agentMutation = true; return () => { agentMutation = false; }; }

export function createAgentRoutes(dependencies: { loadWorkflow: (root: string) => any; broadcast?: () => void }): RouteHandler {
	return async (context) => {
		if (!context.path.startsWith("/api/agents")) return false;
		const root = context.workspaceRoot;
		try {
			if (context.path === "/api/agents" && context.method === "GET") { sendJson(context.res, 200, listAgents(root, dependencies.loadWorkflow(root))); return true; }
			if (context.path === "/api/agents" && context.method === "POST") {
				const release = await acquireAgentMutation(); try { const agent = await readJson<AgentIdentity>(context.req); const result = createAgent(root, agent, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 201, result); return true; } finally { release(); }
			}
			const match = context.path.match(/^\/api\/agents\/([^/]+)$/); if (!match) return false;
			const id = decodeURIComponent(match[1]);
			if (context.method === "PATCH") { const release = await acquireAgentMutation(); try { const patch = await readJson<Partial<AgentIdentity>>(context.req); const result = updateAgent(root, id, patch, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 200, result); return true; } finally { release(); } }
			if (context.method === "DELETE") { const release = await acquireAgentMutation(); try { deleteAgent(root, id, dependencies.loadWorkflow(root)); dependencies.broadcast?.(); sendJson(context.res, 200, { ok: true }); return true; } finally { release(); } }
			return false;
		} catch (error) { sendError(context.res, 400, (error as Error).message); return true; }
	};
}
