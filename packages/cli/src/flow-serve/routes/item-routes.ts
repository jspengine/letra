import type { Workflow } from "../../commands/flow-init.js";
import type { loadHealthRecord } from "../../health-record.js";
import type { logEntry } from "../../session-log.js";
import type { writeFocusFile } from "../../adapters/focus-sync.js";
import type { writeWorkflow } from "../../commands/flow-init.js";
import type { resolveActiveFlowFor } from "../../flow-definition/resolve.js";
import { HttpBodyError, readJson, routeParam, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface ItemRouteDependencies {
	writeWorkflow: typeof writeWorkflow;
	loadHealthRecord: typeof loadHealthRecord;
	writeFocusFile: typeof writeFocusFile;
	logEntry: typeof logEntry;
	resolveActiveFlow: typeof resolveActiveFlowFor;
	broadcast: () => void;
	fireWebhooks: (
		workspaceRoot: string,
		event: string,
		payload: Record<string, unknown>,
	) => Promise<void>;
}

interface CreateItemBody {
	id?: string;
	description?: string;
	stage?: string;
}

interface UpdateItemBody {
	description?: string;
	stage?: string;
	tasks?: Workflow["items"][number]["tasks"];
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) {
		sendError(res, error.status, error.message);
		return;
	}
	sendError(res, 400, (error as Error).message);
}

export function createItemRoutes(dependencies: ItemRouteDependencies): RouteHandler {
	return async (context) => {
		const { method, path, req, res, workspaceRoot, workflow } = context;

		if (path === "/api/items/alerts" && method === "GET") {
			const record = dependencies.loadHealthRecord(workspaceRoot);
			const itemAlerts: Record<string, number> = {};
			for (const entry of record.entries) {
				if (entry.status !== "novo") continue;
				const match = entry.id.match(/_([A-Z]+-\d+)_/);
				if (!match) continue;
				const itemId = match[1];
				itemAlerts[itemId] = (itemAlerts[itemId] ?? 0) + 1;
			}
			sendJson(res, 200, { itemAlerts });
			return true;
		}

		if (path === "/api/items" && method === "POST") {
			try {
				const data = await readJson<CreateItemBody>(req);
				if (!data.id || !data.description || !data.stage) {
					sendError(res, 400, "id, description, and stage required");
					return true;
				}
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				const item: Workflow["items"][number] = {
					id: data.id,
					description: data.description,
					stage: data.stage,
					createdAt: new Date().toISOString(),
					tasks: [],
				};
				workflow.items.push(item);
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					primaryItemId: item.id,
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, item);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		const itemId = routeParam(path, "/api/items/:id");
		if (itemId !== null && method === "GET") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === itemId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			sendJson(res, 200, item);
			return true;
		}

		if (itemId !== null && method === "PATCH") {
			try {
				const data = await readJson<UpdateItemBody>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				const item = workflow.items.find((candidate) => candidate.id === itemId);
				if (!item) {
					sendError(res, 404, "Item not found");
					return true;
				}
				const oldStage = item.stage;
				if (data.stage !== undefined && data.stage !== oldStage) {
					const resolved = dependencies.resolveActiveFlow(workspaceRoot, workflow);
					const targetStage = resolved.flow?.stages.find((stage) => stage.id === data.stage);
					const gate = targetStage?.gate;
					if (gate?.type === "human" && gate.blocking) {
						sendError(
							res,
							422,
							`Gate bloqueante: ${gate.name}. Aprovação humana necessária para entrar em "${targetStage?.name ?? data.stage}".`,
						);
						return true;
					}
					item.stage = data.stage;
				}
				if (data.description !== undefined) item.description = data.description;
				if (data.tasks !== undefined) item.tasks = data.tasks;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					primaryItemId: itemId,
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();

				if (data.stage !== undefined && data.stage !== oldStage) {
					if (item.spec) {
						dependencies.writeFocusFile(workspaceRoot, item.spec, item.id);
						dependencies.logEntry(
							workspaceRoot,
							"focus_sync",
							`Focus synced to ${item.spec} via item move (${item.id})`,
							{ itemId: item.id, spec: item.spec },
						);
						console.log(`  [focus] Synced to ${item.spec} via drag`);
					}
					void dependencies.fireWebhooks(workspaceRoot, "item.moved", {
						itemId: item.id,
						itemDescription: item.description,
						sourceStage: oldStage,
						targetStage: data.stage,
					});
				}
				sendJson(res, 200, item);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		if (itemId !== null && method === "DELETE") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const index = workflow.items.findIndex((candidate) => candidate.id === itemId);
			if (index === -1) {
				sendError(res, 404, "Item not found");
				return true;
			}
			workflow.items.splice(index, 1);
			workflow.updatedAt = new Date().toISOString();
			dependencies.writeWorkflow(workspaceRoot, {
				workflow,
				source: "web-ui",
				skipSitrep: true,
				quiet: true,
			});
			dependencies.broadcast();
			sendJson(res, 200, { deleted: itemId });
			return true;
		}

		const claimId = routeParam(path, "/api/items/:id/claim");
		if (claimId !== null && method === "POST") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === claimId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			const doneZones = new Set(
				workflow.stages.filter((stage) => stage.zone === "done").map((stage) => stage.id),
			);
			if (doneZones.has(item.stage)) {
				sendError(res, 400, "Cannot claim a completed item");
				return true;
			}
			item.claimedBy = "web-ui";
			item.claimedAt = new Date().toISOString();
			workflow.updatedAt = new Date().toISOString();
			dependencies.writeWorkflow(workspaceRoot, {
				workflow,
				source: "web-ui",
				primaryItemId: item.id,
				skipSitrep: true,
				quiet: true,
			});
			dependencies.broadcast();
			sendJson(res, 200, item);
			return true;
		}

		const releaseId = routeParam(path, "/api/items/:id/release");
		if (releaseId !== null && method === "POST") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === releaseId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			delete item.claimedBy;
			delete item.claimedAt;
			workflow.updatedAt = new Date().toISOString();
			dependencies.writeWorkflow(workspaceRoot, {
				workflow,
				source: "web-ui",
				skipSitrep: true,
				quiet: true,
			});
			dependencies.broadcast();
			sendJson(res, 200, item);
			return true;
		}

		const focusId = routeParam(path, "/api/items/:id/focus");
		if (focusId !== null && method === "POST") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === focusId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			const specName = item.spec || focusId;
			dependencies.writeFocusFile(workspaceRoot, specName, item.id);
			dependencies.logEntry(workspaceRoot, "focus_set", `Focus set via UI: ${specName}`, {
				itemId: focusId,
			});
			dependencies.broadcast();
			sendJson(res, 200, { itemId: focusId, spec: specName });
			return true;
		}

		return false;
	};
}
