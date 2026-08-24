import type { writeWorkflow } from "../../commands/flow-init.js";
import type { clearSpec, loadResolvedSpecs, validateSpec, writeSpec } from "../specs.js";
import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface SpecRouteDependencies {
	loadResolvedSpecs: typeof loadResolvedSpecs;
	writeSpec: typeof writeSpec;
	clearSpec: typeof clearSpec;
	validateSpec: typeof validateSpec;
	writeWorkflow: typeof writeWorkflow;
	broadcast: () => void;
}

interface SpecBody {
	id?: string;
	content?: string;
}

function specIdFrom(path: string): string {
	return decodeURIComponent(path.replace("/api/specs/", "").split("/")[0] ?? "");
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) {
		sendError(res, error.status, error.message);
		return;
	}
	sendError(res, 400, (error as Error).message);
}

export function createSpecRoutes(dependencies: SpecRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, workspaceRoot, workspaceDir, workflow }) => {
		if (path === "/api/specs" && method === "GET") {
			try {
				sendJson(res, 200, dependencies.loadResolvedSpecs(workspaceRoot, workflow));
			} catch {
				sendJson(res, 200, []);
			}
			return true;
		}

		if (path === "/api/specs" && method === "POST") {
			try {
				const { id, content } = await readJson<SpecBody>(req);
				if (!id || !content) {
					sendError(res, 400, "id and content required");
					return true;
				}
				dependencies.writeSpec(workspaceDir, id, content);
				if (workflow) {
					workflow.specLinks ??= {};
					workflow.specLinks[id] = { path: `.letra/specs/${id}/spec.md` };
					workflow.updatedAt = new Date().toISOString();
					dependencies.writeWorkflow(workspaceRoot, {
						workflow,
						source: "web-ui",
						skipSitrep: true,
						quiet: true,
					});
					dependencies.broadcast();
				}
				sendJson(res, 200, { id, content });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		if (!path.startsWith("/api/specs/")) return false;
		const specId = specIdFrom(path);

		if (method === "POST" && path.endsWith("/validate")) {
			sendJson(res, 200, dependencies.validateSpec(workspaceDir, specId));
			return true;
		}

		if (method === "DELETE") {
			if (!specId) {
				sendError(res, 400, "spec id required");
				return true;
			}
			dependencies.clearSpec(workspaceDir, specId);
			if (workflow?.specLinks) {
				delete workflow.specLinks[specId];
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
			}
			sendJson(res, 200, { deleted: specId });
			return true;
		}

		if (method === "PUT") {
			try {
				const { content } = await readJson<SpecBody>(req);
				if (content === undefined) {
					sendError(res, 400, "content required");
					return true;
				}
				dependencies.writeSpec(workspaceDir, specId, content);
				if (workflow) {
					workflow.updatedAt = new Date().toISOString();
					dependencies.writeWorkflow(workspaceRoot, {
						workflow,
						source: "web-ui",
						skipSitrep: true,
						quiet: true,
					});
					dependencies.broadcast();
				}
				sendJson(res, 200, { id: specId, content });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		return false;
	};
}
