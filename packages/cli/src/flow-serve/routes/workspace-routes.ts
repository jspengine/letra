import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { writeWorkflow } from "../../commands/flow-init.js";
import type { HarnessManifest } from "../../harness/types.js";
import type { listWorkspaces } from "../../workspace/index.js";
import type {
	createWorkflowFromTemplate,
	registerWorkspaceSetup,
	writeWorkspaceTargetAdapters,
} from "../workspace.js";
import { HttpBodyError, readJson, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";

export interface WorkspaceRouteDependencies {
	listWorkspaces: typeof listWorkspaces;
	switchWorkspace: (root: string) => void;
	switchDirectory: (directory: string | null) => void;
	activeWorkspaceRoot: () => string;
	activeDirectory: () => string | null;
	registerSetup: typeof registerWorkspaceSetup;
	createFromTemplate: typeof createWorkflowFromTemplate;
	writeWorkflow: typeof writeWorkflow;
	writeTargetAdapters: typeof writeWorkspaceTargetAdapters;
	loadHarness: (root: string) => HarnessManifest | null;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) sendError(res, error.status, error.message);
	else sendError(res, 400, (error as Error).message);
}

function templates(harness: HarnessManifest | null) {
	if (!harness) return [];
	return Object.values(harness.flows).map((flow) => {
		const gateIds = new Set(
			flow.stages
				.map((stage) => stage.gate)
				.filter((gate): gate is string => !!gate)
				.map((gate) => gate.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "")),
		);
		const gates = [...gateIds].flatMap((id) => harness.gates[id] ? [harness.gates[id]] : []);
		const roleIds = new Set(flow.stages.flatMap((stage) => stage.agents ?? []));
		const roles = [...roleIds].flatMap((id) => harness.roles[id] ? [harness.roles[id]] : []);
		const policyRefs = new Set(
			gates.flatMap((gate) =>
				gate.policyRef
					? [gate.policyRef.replace(/^.*[\\/]/, "").replace(/\.json$/, "")]
					: [],
			),
		);
		const policies = [...policyRefs].flatMap((id) =>
			harness.policies?.[id] ? [harness.policies[id]] : [],
		);
		return { ...flow, gates, roles, policies };
	});
}

export function createWorkspaceRoutes(dependencies: WorkspaceRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, url, workspaceRoot }) => {
		if (path === "/api/workspaces" && method === "GET") {
			try {
				sendJson(res, 200, dependencies.listWorkspaces().map((workspace) => {
					const legacy = workspace as unknown as Record<string, unknown>;
					return {
						...workspace,
						description: legacy.description || "",
						slug: legacy.slug || workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
						root: legacy.root || "",
						directories: legacy.directories || [],
						tools: legacy.tools || [],
						template: legacy.template || "padrao",
					};
				}));
			} catch {
				sendJson(res, 200, []);
			}
			return true;
		}
		if (path === "/api/workspace/switch" && method === "POST") {
			try {
				const data = await readJson<{ root?: string; workspaceRoot?: string; projectRoot?: string }>(req);
				const root = data.root || data.workspaceRoot || data.projectRoot;
				if (root) dependencies.switchWorkspace(resolve(root));
				const activeRoot = dependencies.activeWorkspaceRoot();
				sendJson(res, 200, { ok: true, workspaceRoot: activeRoot, projectRoot: activeRoot });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workspace/directory/switch" && method === "POST") {
			try {
				const data = await readJson<{ directory?: string | null }>(req);
				dependencies.switchDirectory(data.directory || null);
				sendJson(res, 200, { ok: true, activeDirectory: dependencies.activeDirectory() });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workflow/setup" && method === "POST") {
			try {
				const data = await readJson<Record<string, unknown>>(req);
				const name = String(data.name || "Workspace").trim();
				const description = String(data.description || "").trim();
				const workspacePath = String(data.workspacePath || "").trim();
				const directories = Array.isArray(data.directories) ? data.directories as string[] : [];
				const tools = Array.isArray(data.tools) ? data.tools as string[] : [];
				const template = String(data.template || "padrao");
				const setup = dependencies.registerSetup({
					name,
					description,
					workspacePath: resolve(workspacePath || process.cwd()),
					directories,
					tools,
					template,
				});
				const workflow = dependencies.createFromTemplate(
					setup.workspaceRoot,
					template,
					{ name, tools },
					dependencies.loadHarness(setup.workspaceRoot),
				);
				dependencies.writeWorkflow(setup.workspaceRoot, {
					workflow,
					source: "web-ui",
					skipSitrep: true,
					quiet: true,
				});
				dependencies.writeTargetAdapters(setup.workspaceRoot, directories, tools);
				sendJson(res, 200, { workspace: setup.workspace, workflow });
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/harness/templates" && method === "GET") {
			sendJson(res, 200, templates(dependencies.loadHarness(workspaceRoot)));
			return true;
		}
		if (path === "/api/fs/dirs" && method === "GET") {
			const dirPath = url.searchParams.get("path") || process.cwd();
			try {
				const dirs = readdirSync(dirPath, { withFileTypes: true })
					.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
					.map((entry) => ({
						name: entry.name,
						path: join(dirPath, entry.name).replace(/\\/g, "/"),
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
				sendJson(res, 200, { path: dirPath, dirs });
			} catch {
				sendJson(res, 200, { path: dirPath, dirs: [], error: "Could not read directory" });
			}
			return true;
		}
		return false;
	};
}
