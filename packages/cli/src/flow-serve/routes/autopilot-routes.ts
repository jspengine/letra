import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface AutopilotStatus {
	enabled: boolean;
	activeItems: number;
	waitingHuman: number;
	updatedAt: string | null;
}

export interface AutopilotRouteDependencies {
	getStatus: (workspaceRoot: string) => AutopilotStatus;
	setEnabled: (workspaceRoot: string, enabled: boolean) => AutopilotStatus;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) sendError(res, error.status, error.message);
	else sendError(res, 400, error instanceof Error ? error.message : String(error));
}

export function createAutopilotRoutes(
	dependencies: AutopilotRouteDependencies,
): RouteHandler {
	return async ({ method, path, req, res, workspaceRoot }) => {
		if (path !== "/api/autopilot") return false;

		if (method === "GET") {
			sendJson(res, 200, dependencies.getStatus(workspaceRoot));
			return true;
		}

		if (method === "POST") {
			try {
				const data = await readJson<{ enabled?: unknown }>(req);
				if (typeof data.enabled !== "boolean") {
					throw new HttpBodyError("The 'enabled' field must be a boolean", 400);
				}
				sendJson(res, 200, dependencies.setEnabled(workspaceRoot, data.enabled));
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		return false;
	};
}
