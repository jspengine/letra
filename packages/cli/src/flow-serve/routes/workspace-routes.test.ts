import { mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createRequestContext } from "../request-context.js";
import { createWorkspaceRoutes, type WorkspaceRouteDependencies } from "./workspace-routes.js";

function request(method: string, body = ""): IncomingMessage {
	const req = Readable.from(body ? [body] : []) as IncomingMessage;
	req.method = method;
	return req;
}

function response() {
	return {
		writeHead: vi.fn(),
		end: vi.fn(),
	} as unknown as ServerResponse;
}

describe("workspace routes", () => {
	it("enriches lightweight workspace indexes with directories from workflow locations", async () => {
		const workspaceRoot = join(tmpdir(), `letra-workspace-routes-${Date.now()}`);
		mkdirSync(join(workspaceRoot, ".letra"), { recursive: true });
		writeFileSync(
			join(workspaceRoot, ".letra", "workflow.json"),
			JSON.stringify({
				version: "1.0",
				name: "anotei aqui",
				description: "Workspace Anotei Aqui",
				createdAt: "2026-08-18T14:07:15.628Z",
				updatedAt: "2026-08-18T14:07:15.628Z",
				stages: [],
				items: [],
				tools: ["opencode", "codex"],
				template: "padrao",
				locations: [{ id: "loc-1", path: "C:/Workspace/AnoteiAqui", label: "AnoteiAqui" }],
			}),
			"utf-8",
		);
		const req = request("GET");
		const res = response();
		const deps = {
			listWorkspaces: vi.fn().mockReturnValue([
				{
					id: "ws-anotei",
					name: "anotei aqui",
					slug: "anotei-aqui",
					root: workspaceRoot,
					createdAt: "2026-08-18T14:07:15.628Z",
				},
			]),
		} as unknown as WorkspaceRouteDependencies;
		const context = createRequestContext(req, res, new URL("http://localhost/api/workspaces"), {
			workspaceRoot,
			workspaceDir: join(workspaceRoot, ".letra"),
			workflow: null,
		});

		await expect(createWorkspaceRoutes(deps)(context)).resolves.toBe(true);

		const end = res.end as unknown as { mock: { calls: unknown[][] } };
		const payload = JSON.parse(String(end.mock.calls[0][0]));
		expect(payload).toEqual([
			expect.objectContaining({
				name: "anotei aqui",
				description: "Workspace Anotei Aqui",
				directories: ["C:/Workspace/AnoteiAqui"],
				tools: ["opencode", "codex"],
				template: "padrao",
			}),
		]);
	});

	it("returns dataDir when switching workspace", async () => {
		const workspaceRoot = join(tmpdir(), `letra-workspace-switch-${Date.now()}`);
		mkdirSync(join(workspaceRoot, ".letra"), { recursive: true });
		writeFileSync(
			join(workspaceRoot, ".letra", "workflow.json"),
			JSON.stringify({
				version: "1.0",
				name: "Switch",
				stages: [],
				items: [],
				tools: [],
			}),
			"utf-8",
		);
		const req = request("POST", JSON.stringify({ workspaceRoot }));
		const res = response();
		const deps = {
			switchWorkspace: vi.fn(),
			activeWorkspaceRoot: vi.fn().mockReturnValue(workspaceRoot),
		} as unknown as WorkspaceRouteDependencies;
		const context = createRequestContext(
			req,
			res,
			new URL("http://localhost/api/workspace/switch"),
			{ workspaceRoot, workspaceDir: join(workspaceRoot, ".letra"), workflow: null },
		);

		await expect(createWorkspaceRoutes(deps)(context)).resolves.toBe(true);

		const end = res.end as unknown as { mock: { calls: unknown[][] } };
		const payload = JSON.parse(String(end.mock.calls[0][0]));
		expect(payload).toEqual(
			expect.objectContaining({
				ok: true,
				workspaceRoot,
				dataDir: join(workspaceRoot, ".letra"),
				locationPath: workspaceRoot,
			}),
		);
	});

	it("plans setup using dataDir and normalized workflow locations", async () => {
		const workspaceRoot = join(tmpdir(), `letra-workspace-plan-${Date.now()}`);
		const dataDirInput = "~/.letra/workspaces/plan-demo";
		const dataDir = join(homedir(), ".letra", "workspaces", "plan-demo");
		const projectDir = join(workspaceRoot, "project-a");
		const req = request(
			"POST",
			JSON.stringify({
				proposalId: "proposal-1",
				dataDir: dataDirInput,
				name: "Plan Demo",
				template: "padrao",
				locations: [
					{ id: "loc-project-a", label: "Project A", path: projectDir, adapters: [] },
				],
			}),
		);
		const res = response();
		const deps = {
			createFromTemplate: vi.fn().mockReturnValue({
				version: "1.0",
				name: "Plan Demo",
				stages: [],
				items: [],
				tools: [],
			}),
			loadHarness: vi.fn().mockReturnValue(null),
			planSetup: vi.fn().mockImplementation((input) => ({
				proposalId: input.proposalId,
				workspaceRoot: input.workspaceRoot,
				conflictCount: 0,
				operations: [
					{
						kind: "create",
						path: join(input.workspaceRoot, "workflow.json"),
						reason: "Harness",
					},
				],
				locations: input.workflow.locations,
			})),
		} as unknown as WorkspaceRouteDependencies;
		const context = createRequestContext(
			req,
			res,
			new URL("http://localhost/api/workspace/setup/plan"),
			{ workspaceRoot, workspaceDir: dataDir, workflow: null },
		);

		await expect(createWorkspaceRoutes(deps)(context)).resolves.toBe(true);

		expect(deps.createFromTemplate).toHaveBeenCalledWith(
			dataDir,
			"padrao",
			{ name: "Plan Demo", tools: [] },
			null,
		);
		expect(deps.loadHarness).toHaveBeenCalledWith(workspaceRoot);
		expect(deps.planSetup).toHaveBeenCalledWith(
			expect.objectContaining({
				proposalId: "proposal-1",
				workspaceRoot: dataDir,
				targets: [
					{ id: "loc-project-a", label: "Project A", path: projectDir, adapters: [] },
				],
				workflow: expect.objectContaining({
					locations: [
						{
							id: "loc-project-a",
							label: "Project A",
							path: projectDir.replace(/\\/g, "/"),
							adapters: [],
						},
					],
				}),
			}),
		);
	});

	it("creates workflow setup in the external dataDir without resolving links from that new path", async () => {
		const workspaceRoot = join(tmpdir(), `letra-active-${Date.now()}`);
		const dataDirInput = "~/.letra/workspaces/create-demo";
		const dataDir = join(homedir(), ".letra", "workspaces", "create-demo");
		const projectDir = join(tmpdir(), `letra-project-${Date.now()}`);
		const workflow = {
			version: "1.0",
			name: "Create Demo",
			createdAt: "2026-08-21T00:00:00.000Z",
			updatedAt: "2026-08-21T00:00:00.000Z",
			stages: [],
			items: [],
			tools: [],
		};
		const req = request(
			"POST",
			JSON.stringify({
				proposalId: "proposal-create",
				dataDir: dataDirInput,
				name: "Create Demo",
				template: "padrao",
				directories: [projectDir],
				locations: [
					{ id: "loc-project", label: "Project", path: projectDir, adapters: [] },
				],
			}),
		);
		const res = response();
		const deps = {
			createFromTemplate: vi.fn().mockReturnValue(workflow),
			loadHarness: vi.fn().mockReturnValue(null),
			planSetup: vi.fn().mockImplementation((input) => ({
				proposalId: input.proposalId,
				workspaceRoot: input.workspaceRoot,
				conflictCount: 0,
				operations: [
					{
						kind: "create",
						path: join(input.workspaceRoot, "workflow.json"),
						reason: "Harness",
					},
				],
			})),
			captureSetup: vi.fn().mockReturnValue([]),
			registerSetup: vi.fn().mockReturnValue({
				workspace: { id: "ws_create", name: "Create Demo", root: dataDir },
				workspaceRoot: dataDir,
				registryFile: join(dataDir, "workspace.json"),
			}),
			writeExternalSetup: vi.fn(),
			writeTargetAdapters: vi.fn(),
			saveSetupManifest: vi.fn().mockReturnValue("setup-abc"),
			restoreSetup: vi.fn(),
		} as unknown as WorkspaceRouteDependencies;
		const context = createRequestContext(
			req,
			res,
			new URL("http://localhost/api/workflow/setup"),
			{ workspaceRoot, workspaceDir: join(workspaceRoot, ".letra"), workflow: null },
		);

		await expect(createWorkspaceRoutes(deps)(context)).resolves.toBe(true);

		expect(deps.loadHarness).toHaveBeenCalledWith(workspaceRoot);
		expect(deps.createFromTemplate).toHaveBeenCalledWith(
			dataDir,
			"padrao",
			{ name: "Create Demo", tools: [] },
			null,
		);
		expect(deps.writeExternalSetup).toHaveBeenCalledWith(
			dataDir,
			expect.objectContaining({
				name: "Create Demo",
				locations: [
					{
						id: "loc-project",
						label: "Project",
						path: projectDir.replace(/\\/g, "/"),
						adapters: [],
					},
				],
			}),
			expect.objectContaining({ id: "ws_create", root: dataDir }),
		);
		expect(deps.restoreSetup).not.toHaveBeenCalled();
		const end = res.end as unknown as { mock: { calls: unknown[][] } };
		const payload = JSON.parse(String(end.mock.calls[0][0]));
		expect(payload).toEqual(expect.objectContaining({ rollbackId: "setup-abc" }));
	});
});
