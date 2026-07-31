import type { Workflow, writeWorkflow } from "../../commands/flow-init.js";
import type { HarnessManifest } from "../../harness/types.js";
import type { resolveActiveFlowFor } from "../../flow-definition/resolve.js";
import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface WorkflowRouteDependencies {
	writeWorkflow: typeof writeWorkflow;
	resolveActiveFlow: typeof resolveActiveFlowFor;
	detectWorkspaceName: (root: string) => string | null;
	loadHarness: (root: string) => HarnessManifest | null;
	createFromTemplate: (
		root: string,
		template: string,
		options: { name?: string; tools?: string[] },
		harness: HarnessManifest | null,
	) => Workflow;
	broadcast: () => void;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) sendError(res, error.status, error.message);
	else sendError(res, 400, (error as Error).message);
}

export function createWorkflowRoutes(dependencies: WorkflowRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, url, workspaceRoot, workflow }) => {
		if (path === "/api/workflow" && method === "GET") {
			sendJson(res, 200, workflow ?? { error: "No workflow found" });
			return true;
		}
		if (path === "/api/workflow/active-flow" && method === "GET") {
			sendJson(res, 200, dependencies.resolveActiveFlow(workspaceRoot, workflow).flow ?? null);
			return true;
		}
		if (path === "/api/workflow/template" && method === "POST") {
			try {
				const data = await readJson<{
					template: string;
					name?: string;
					tools?: string[];
					stages?: Array<{ id: string; name: string; zone?: Workflow["stages"][number]["zone"] }>;
				}>(req);
				let next: Workflow;
				if (data.stages) {
					next = {
						version: "1.0",
						name: data.name ?? dependencies.detectWorkspaceName(workspaceRoot) ?? "Personalizado",
						language: workflow?.language,
						createdAt: workflow?.createdAt ?? new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						stages: data.stages.map((stage, order) => ({ ...stage, order })),
						items: workflow?.items ?? [],
						specLinks: workflow?.specLinks,
						tools: data.tools ?? workflow?.tools ?? [],
					};
				} else {
					next = dependencies.createFromTemplate(
						workspaceRoot,
						data.template,
						{ name: data.name, tools: data.tools },
						dependencies.loadHarness(workspaceRoot),
					);
					if (workflow?.language) next.language = workflow.language;
				}
				dependencies.writeWorkflow(workspaceRoot, {
					workflow: next,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, next);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workflow" && method === "PATCH") {
			try {
				const data = await readJson<Partial<Pick<Workflow, "stages" | "name" | "description">>>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (data.stages !== undefined) workflow.stages = data.stages;
				if (data.name !== undefined) workflow.name = data.name;
				if (data.description !== undefined) workflow.description = data.description;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, workflow);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workflow/adapters" && method === "GET") {
			try {
				const { ADAPTER_REGISTRY } = await import("../../adapters/registry.js");
				const { existsSync } = await import("node:fs");
				const { join } = await import("node:path");
				const activeTools = workflow?.tools ?? [];
				const adapters = Object.values(ADAPTER_REGISTRY).map((adapter) => ({
					id: adapter.id,
					displayName: adapter.displayName,
					capabilities: adapter.capabilities,
					detectionPaths: adapter.detectionPaths,
					active: activeTools.includes(adapter.id),
					detected: adapter.detectionPaths.some((p) => existsSync(join(workspaceRoot, p))),
				}));
				sendJson(res, 200, adapters);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workflow/adapters" && method === "PATCH") {
			try {
				const data = await readJson<{ tools: string[] }>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				workflow.tools = data.tools;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, { tools: workflow.tools });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workflow/locations" && method === "POST") {
			try {
				const data = await readJson<{ id: string; path: string; label: string }>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (!workflow.locations) workflow.locations = [];
				const location = { id: data.id, path: data.path, label: data.label };
				workflow.locations.push(location);
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, location);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path.startsWith("/api/workflow/locations/") && method === "PATCH") {
			try {
				const locationId = path.split("/").pop();
				const data = await readJson<{ label?: string; path?: string }>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (!workflow.locations) workflow.locations = [];
				const location = workflow.locations.find((l) => l.id === locationId);
				if (!location) {
					sendError(res, 404, "Location not found");
					return true;
				}
				if (data.label !== undefined) location.label = data.label;
				if (data.path !== undefined) location.path = data.path;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, location);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path.startsWith("/api/workflow/locations/") && method === "DELETE") {
			try {
				const locationId = path.split("/").pop();
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (!workflow.locations) workflow.locations = [];
				const index = workflow.locations.findIndex((l) => l.id === locationId);
				if (index === -1) {
					sendError(res, 404, "Location not found");
					return true;
				}
				workflow.locations.splice(index, 1);
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, { ok: true });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/move") {
			const itemId = url.searchParams.get("item");
			const stage = url.searchParams.get("stage");
			const item = itemId ? workflow?.items.find((candidate) => candidate.id === itemId) : null;
			if (item && stage && workflow) {
				item.stage = stage;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					primaryItemId: item.id,
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
			}
			res.writeHead(302, { Location: "/" });
			res.end();
			return true;
		}
		return false;
	};
}
