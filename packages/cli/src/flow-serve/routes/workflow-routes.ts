import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

function normalizedPath(path: string): string {
	return path.replace(/\\/g, "/");
}

function stableLocationId(path: string): string {
	const normalized = normalizedPath(path).toLowerCase();
	let hash = 2166136261;
	for (const char of normalized) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const name =
		normalized
			.split("/")
			.filter(Boolean)
			.pop()
			?.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 32) || "project";
	return `loc-${name}-${(hash >>> 0).toString(36)}`;
}

function labelFromPath(path: string, fallback = "Projeto"): string {
	return normalizedPath(path).split("/").filter(Boolean).pop() || fallback;
}

function assertProjectDirectory(path: string): string {
	const resolved = resolve(path);
	if (!existsSync(resolved)) throw new Error("A pasta de projeto não existe.");
	return resolved;
}

function linkPathFor(locationPath: string): string {
	return join(resolve(locationPath), ".letra-link");
}

function readLink(locationPath: string): string | null {
	const path = linkPathFor(locationPath);
	if (!existsSync(path)) return null;
	return readFileSync(path, "utf-8").trim();
}

function writeLocationLink(locationPath: string, dataDir: string): void {
	const resolved = assertProjectDirectory(locationPath);
	writeFileSync(join(resolved, ".letra-link"), `${dataDir}\n`, "utf-8");
}

function removeLocationLinkIfOwned(locationPath: string, dataDir: string): boolean {
	const path = linkPathFor(locationPath);
	const current = readLink(locationPath);
	if (!current || normalizedPath(current) !== normalizedPath(dataDir)) return false;
	unlinkSync(path);
	return true;
}

export function createWorkflowRoutes(dependencies: WorkflowRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, url, workspaceRoot, workspaceDir, workflow }) => {
		if (path === "/api/workflow" && method === "GET") {
			sendJson(res, 200, workflow ?? { error: "No workflow found" });
			return true;
		}
		if (path === "/api/workflow/active-flow" && method === "GET") {
			sendJson(
				res,
				200,
				dependencies.resolveActiveFlow(workspaceRoot, workflow).flow ?? null,
			);
			return true;
		}
		if (path === "/api/workflow/template" && method === "POST") {
			try {
				const data = await readJson<{
					template: string;
					name?: string;
					tools?: string[];
					stages?: Array<{
						id: string;
						name: string;
						zone?: Workflow["stages"][number]["zone"];
					}>;
				}>(req);
				let next: Workflow;
				if (data.stages) {
					next = {
						version: "1.0",
						name:
							data.name ??
							dependencies.detectWorkspaceName(workspaceRoot) ??
							"Personalizado",
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
					// Preserve existing items across a template change: keep the stage if it still
					// exists in the new template, otherwise relocate to the first "todo" stage.
					const nextStages = next.stages ?? [];
					const fallbackStage =
						nextStages.find((s) => s.zone === "todo")?.id ??
						nextStages[0]?.id ??
						"backlog";
					const stageIds = new Set(nextStages.map((s) => s.id));
					next.items = (workflow?.items ?? []).map((item) =>
						stageIds.has(item.stage) ? item : { ...item, stage: fallbackStage },
					);
					if (!next.locations || (next.locations?.length ?? 0) === 0)
						next.locations = workflow?.locations;
					if (!next.specLinks || Object.keys(next.specLinks).length === 0)
						next.specLinks = workflow?.specLinks;
					if (!next.tools || (next.tools?.length ?? 0) === 0)
						next.tools = workflow?.tools ?? [];
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
				const data =
					await readJson<Partial<Pick<Workflow, "stages" | "name" | "description">>>(req);
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
					detected: adapter.detectionPaths.some((p) =>
						existsSync(join(workspaceRoot, p)),
					),
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
				const data = await readJson<{
					id?: string;
					path?: string;
					label?: string;
					adapters?: string[];
					locations?: Array<{
						id?: string;
						path: string;
						label?: string;
						adapters?: string[];
					}>;
				}>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (!workflow.locations) workflow.locations = [];
				const inputs =
					Array.isArray(data.locations) && data.locations.length > 0
						? data.locations
						: data.path
							? [
									{
										id: data.id,
										path: data.path,
										label: data.label,
										adapters: data.adapters,
									},
								]
							: [];
				if (inputs.length === 0) throw new Error("Informe ao menos uma pasta de projeto.");
				const added = inputs.map((input, index) => {
					const projectPath = normalizedPath(assertProjectDirectory(input.path));
					const location = {
						id: input.id || stableLocationId(projectPath),
						path: projectPath,
						label: input.label || labelFromPath(projectPath, `Projeto ${index + 1}`),
						adapters: Array.isArray(input.adapters) ? [...new Set(input.adapters)] : [],
					};
					const existing = workflow.locations?.find(
						(candidate) =>
							candidate.id === location.id ||
							normalizedPath(candidate.path) === location.path,
					);
					if (existing) {
						existing.path = location.path;
						existing.label = location.label;
						existing.adapters = location.adapters;
						writeLocationLink(existing.path, workspaceDir);
						return existing;
					}
					workflow.locations?.push(location);
					writeLocationLink(location.path, workspaceDir);
					return location;
				});
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, added.length === 1 ? added[0] : { locations: added });
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
				if (data.path !== undefined) {
					location.path = normalizedPath(assertProjectDirectory(data.path));
					writeLocationLink(location.path, workspaceDir);
				}
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
				const [removed] = workflow.locations.splice(index, 1);
				const linkRemoved = removed
					? removeLocationLinkIfOwned(removed.path, workspaceDir)
					: false;
				workflow.updatedAt = new Date().toISOString();
				dependencies.writeWorkflow(workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.broadcast();
				sendJson(res, 200, { ok: true, linkRemoved });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (
			path.startsWith("/api/workflow/locations/") &&
			path.endsWith("/repair-link") &&
			method === "POST"
		) {
			try {
				const locationId = path.split("/").at(-2);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				const location = workflow.locations?.find((l) => l.id === locationId);
				if (!location) {
					sendError(res, 404, "Location not found");
					return true;
				}
				writeLocationLink(location.path, workspaceDir);
				sendJson(res, 200, {
					ok: true,
					location,
					linkPath: normalizedPath(linkPathFor(location.path)),
					dataDir: normalizedPath(workspaceDir),
				});
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/move") {
			const itemId = url.searchParams.get("item");
			const stage = url.searchParams.get("stage");
			const item = itemId
				? workflow?.items.find((candidate) => candidate.id === itemId)
				: null;
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
