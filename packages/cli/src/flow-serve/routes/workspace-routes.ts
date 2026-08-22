import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { writeWorkflow } from "../../commands/flow-init.js";
import type { HarnessManifest } from "../../harness/types.js";
import type { listWorkspaces } from "../../workspace/index.js";
import type {
	analyzeWorkspaceSetup,
	captureWorkspaceSetup,
	createWorkflowFromTemplate,
	planWorkspaceSetup,
	registerWorkspaceSetup,
	rollbackWorkspaceSetup,
	saveWorkspaceSetupManifest,
	restoreWorkspaceSetup,
	writeExternalWorkspaceSetup,
	writeWorkspaceTargetAdapters,
} from "../workspace.js";
import { workflowLocations } from "../workspace.js";
import { migrateWorkspace, type MigrateResult } from "../../commands/migrate.js";
import { getLetraDir, resolveWorkspaceRoot } from "../../workspace/resolver.js";
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
	writeExternalSetup: typeof writeExternalWorkspaceSetup;
	writeTargetAdapters: typeof writeWorkspaceTargetAdapters;
	analyzeSetup: typeof analyzeWorkspaceSetup;
	planSetup: typeof planWorkspaceSetup;
	captureSetup: typeof captureWorkspaceSetup;
	restoreSetup: typeof restoreWorkspaceSetup;
	saveSetupManifest: typeof saveWorkspaceSetupManifest;
	rollbackSetup: typeof rollbackWorkspaceSetup;
	loadHarness: (root: string) => HarnessManifest | null;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) sendError(res, error.status, error.message);
	else sendError(res, 400, (error as Error).message);
}

function resolveUserPath(path: string, fallback = process.cwd()): string {
	const input = path.trim();
	if (!input) return resolve(fallback);
	if (input === "~") return homedir();
	if (input.startsWith("~/") || input.startsWith("~\\")) {
		return resolve(homedir(), input.slice(2));
	}
	return resolve(input);
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
	return async ({ method, path, req, res, url, workspaceRoot, workspaceDir }) => {
		if (path === "/api/workspaces" && method === "GET") {
			try {
				// Source of truth para a listagem: os workspaces registrados no
			// registry external (~/.letra/workspaces) + o workspace ATIVO do cwd
			// (que tem .letra/workflow.json mas não precisa estar registrado).
			const registered = dependencies.listWorkspaces() as unknown as Array<
				Record<string, unknown>
			>;
			const active = workspaceRoot;
			const hasActive =
				typeof active === "string" &&
				active.length > 0 &&
				existsSync(join(getLetraDir(active), "workflow.json"));
			const workspaces: Array<Record<string, unknown>> = hasActive
				? registered.some((w) => String(w.root ?? "") === active)
					? registered
					: [
							{
								id: "ws-active",
								name: active.split(/[/\\]/).pop() ?? "workspace",
								root: active,
								createdAt: new Date().toISOString(),
							},
							...registered,
						]
				: registered;
			sendJson(res, 200, workspaces.map((workspace) => {
						const legacy = workspace as unknown as Record<string, unknown>;
						const root = String(legacy.root || "");
						const dataDir = root ? getLetraDir(root) : null;
						const wfPath = dataDir ? join(dataDir, "workflow.json") : null;
						let wf: Record<string, unknown> | null = null;
						if (wfPath && existsSync(wfPath)) {
							try { wf = JSON.parse(readFileSync(wfPath, "utf-8")) as Record<string, unknown>; } catch {}
						}
						const wfLocations = wf && Array.isArray(wf.locations) ? (wf.locations as Array<Record<string, unknown>>) : [];
						return {
							...workspace,
							description: String(legacy.description || wf?.description || ""),
							slug: legacy.slug || String(workspace.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
							root: root,
							dataDir,
							directories: legacy.directories || wfLocations.map((l) => String(l?.path ?? "")).filter(Boolean),
							tools: legacy.tools || (wf && Array.isArray(wf.tools) ? wf.tools : []),
							template: legacy.template || String(wf?.template || "padrao"),
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
				const activeResolution = resolveWorkspaceRoot(activeRoot);
				sendJson(res, 200, {
					ok: true,
					workspaceRoot: activeRoot,
					dataDir: activeResolution.workspaceDir,
					locationPath: activeResolution.locationPath,
					projectRoot: activeRoot,
				});
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
		if (path === "/api/workspace/setup/analyze" && method === "POST") {
			try {
				const data = await readJson<{ name?: string; root?: string }>(req);
				sendJson(res, 200, dependencies.analyzeSetup({
					name: String(data.name || "").trim(),
					root: String(data.root || "").trim(),
				}));
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workspace/setup/plan" && method === "POST") {
			try {
				const data = await readJson<{
					proposalId?: string;
					workspaceRoot?: string;
					dataDir?: string;
					name?: string;
					template?: string;
					locations?: Array<{ id: string; label: string; path: string; adapters: string[] }>;
				}>(req);
				const locations = Array.isArray(data.locations) ? data.locations : [];
				const tools = [...new Set(locations.flatMap((location) => location.adapters))];
				const root = resolveUserPath(String(data.dataDir || data.workspaceRoot || workspaceDir || ""));
				const workflow = dependencies.createFromTemplate(
					root,
					String(data.template || "padrao"),
					{ name: String(data.name || "Workspace"), tools },
					dependencies.loadHarness(workspaceRoot),
				);
				workflow.locations = workflowLocations(locations, root);
				sendJson(res, 200, dependencies.planSetup({
					proposalId: String(data.proposalId || ""),
					workspaceRoot: root,
					targets: locations,
					workflow,
				}));
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/workspace/setup/rollback" && method === "POST") {
			try {
				const data = await readJson<{ workspaceRoot?: string; manifestId?: string }>(req);
				dependencies.rollbackSetup(
					String(data.workspaceRoot || ""),
					String(data.manifestId || ""),
				);
				sendJson(res, 200, { ok: true });
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
				const workspacePath = String(data.dataDir || data.workspacePath || "").trim();
				const directories = Array.isArray(data.directories) ? data.directories as string[] : [];
				const tools = Array.isArray(data.tools) ? data.tools as string[] : [];
				const locations = Array.isArray(data.locations)
					? data.locations as Array<{ id: string; label: string; path: string; adapters: string[] }>
					: directories.map((directory, index) => ({
						id: `loc-${index + 1}`,
						label: directory.replace(/\\/g, "/").split("/").pop() || `Projeto ${index + 1}`,
						path: directory,
						adapters: tools,
					}));
				const template = String(data.template || "padrao");
				const resolvedWorkspacePath = resolveUserPath(workspacePath);
				const workflow = dependencies.createFromTemplate(
					resolvedWorkspacePath,
					template,
					{ name, tools },
					dependencies.loadHarness(workspaceRoot),
				);
				workflow.locations = workflowLocations(locations, resolvedWorkspacePath);
				const plan = dependencies.planSetup({
					proposalId: String(data.proposalId || "legacy-setup"),
					workspaceRoot: resolvedWorkspacePath,
					targets: locations,
					workflow,
				});
				if (plan.conflictCount > 0) {
					throw new Error("O plano contém conflitos. Revise e preserve os arquivos antes de criar o workspace.");
				}
				const snapshots = dependencies.captureSetup(plan);
				try {
					const setup = dependencies.registerSetup({
						name,
						description,
						workspacePath: resolvedWorkspacePath,
						directories,
						tools,
						template,
					});
					snapshots.push({ path: setup.registryFile, existed: false });
					dependencies.writeExternalSetup(resolvedWorkspacePath, workflow, setup.workspace);
					dependencies.writeTargetAdapters(resolvedWorkspacePath, locations, workflow);
					const rollbackId = dependencies.saveSetupManifest(
						resolvedWorkspacePath,
						plan.proposalId,
						plan.operations,
						snapshots,
					);
					sendJson(res, 200, { workspace: setup.workspace, workflow, rollbackId });
				} catch (error) {
					dependencies.restoreSetup(snapshots);
					throw error;
				}
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}
		if (path === "/api/harness/templates" && method === "GET") {
			sendJson(res, 200, templates(dependencies.loadHarness(workspaceRoot)));
			return true;
		}
		if (path === "/api/harness/roles" && method === "GET") {
			const harness = dependencies.loadHarness(workspaceRoot);
			const roles = harness
				? Object.values(harness.roles).map((r) => ({
						id: r.id,
						label: r.label,
						description: r.description || "",
						allowedStages: r.allowedStages || [],
						capabilities: r.capabilities || [],
					}))
				: [];
			sendJson(res, 200, roles);
			return true;
		}
				if (path === "/api/fs/dirs" && method === "GET") {
					const dirPath = url.searchParams.get("path") || process.cwd();
					try {
						const dirs = readdirSync(dirPath, { withFileTypes: true })
							.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
							.map((entry) => ({
								name: entry.name,
								path: join(dirPath, entry.name).replace(/\\\\/g, "/"),
							}))
							.sort((a, b) => a.name.localeCompare(b.name));
						sendJson(res, 200, { path: dirPath, dirs });
					} catch {
						sendJson(res, 200, { path: dirPath, dirs: [], error: "Could not read directory" });
					}
					return true;
				}
				if (path === "/api/workflow/migrate-harness" && method === "POST") {
					try {
						const data = await readJson<{ workspaceRoot?: string; dataDir?: string; clean?: boolean; dryRun?: boolean }>(req);
						const root = resolveUserPath(String(data.dataDir || data.workspaceRoot || dependencies.activeWorkspaceRoot()));
						const result: MigrateResult = await migrateWorkspace(root, { clean: !!data.clean, dryRun: !!data.dryRun });
						sendJson(res, result.ok ? 200 : 409, result);
					} catch (error) {
						sendBodyError(error, res);
					}
					return true;
				}
				return false;
			};
		}
