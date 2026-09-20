import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../commands/flow-init.js";
import { createRequestContext } from "../request-context.js";
import { createWorkflowRoutes, type WorkflowRouteDependencies } from "./workflow-routes.js";

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Letra",
		description: "Workspace settings",
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "code", name: "Code", order: 1 },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Keep backlog",
				stage: "backlog",
				createdAt: "2026-08-01T00:00:00.000Z",
			},
			{
				id: "ITEM-2",
				description: "Move from removed stage",
				stage: "code",
				createdAt: "2026-08-01T00:00:00.000Z",
			},
		],
		locations: [{ id: "loc-1", path: "C:/Workspace/letra", label: "Letra", adapters: [] }],
		specLinks: { "ITEM-2": { path: "workspace-settings" } },
		tools: ["opencode"],
		template: "sdlc",
	};
}

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

function payload(res: ServerResponse): unknown {
	const end = res.end as unknown as { mock: { calls: unknown[][] } };
	return JSON.parse(String(end.mock.calls[0][0]));
}

function deps() {
	return {
		writeWorkflow: vi.fn(),
		resolveActiveFlow: vi.fn(),
		detectWorkspaceName: vi.fn().mockReturnValue("Letra"),
		loadHarness: vi.fn().mockReturnValue(null),
		createFromTemplate: vi.fn(),
		resolveHumanActor: vi.fn().mockReturnValue("human:test-session"),
		broadcast: vi.fn(),
	} as unknown as WorkflowRouteDependencies;
}

describe("workflow routes", () => {
	let tmpRoot: string | null = null;

	afterEach(() => {
		if (tmpRoot && existsSync(tmpRoot)) {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
		tmpRoot = null;
	});

	it("exposes the canonical draft, validation, publication and rollback lifecycle", async () => {
		tmpRoot = join(tmpdir(), `letra-workflow-versions-route-${Date.now()}`);
		mkdirSync(join(tmpRoot, ".letra"), { recursive: true });
		const dependencies = deps();
		const route = createWorkflowRoutes(dependencies);
		const call = async (method: string, path: string, body?: unknown) => {
			const req = request(method, body === undefined ? "" : JSON.stringify(body));
			const res = response();
			const context = createRequestContext(req, res, new URL(`http://localhost${path}`), { workspaceRoot: tmpRoot!, workspaceDir: join(tmpRoot!, ".letra"), workflow: workflow() });
			expect(await route(context)).toBe(true);
			return { res, body: payload(res) as any };
		};
		const content = { name: "Visual", initialStageId: "draft", stages: [{ id: "draft", transitions: [{ target: "done" }] }, { id: "done", final: true }] };
		const created = await call("POST", "/api/workflow-definitions", { name: "Visual", actor: "human:owner", content });
		const id = created.body.definition.id as string;
		expect(created.res.writeHead).toHaveBeenCalledWith(201, expect.anything());
		const validation = await call("POST", `/api/workflow-definitions/${id}/validate`);
		expect(validation.body).toEqual({ valid: true, errors: [] });
		const published = await call("POST", `/api/workflow-definitions/${id}/publish`, { actor: "human:owner", expectedRevision: 1, reason: "Initial publication" });
		expect(published.body.number).toBe(1);
		const rollback = await call("POST", `/api/workflow-definitions/${id}/rollback`, { actor: "human:owner", versionNumber: 1, reason: "Audit rollback" });
		expect(rollback.body).toMatchObject({ number: 2, restoredFromVersionId: published.body.id });
		const history = await call("GET", `/api/workflow-definitions/${id}/versions`);
		expect(history.body).toHaveLength(2);
	});

	it("rejects publish when no server-side human actor is resolved", async () => {
		tmpRoot = join(tmpdir(), `letra-workflow-human-actor-route-${Date.now()}`);
		mkdirSync(join(tmpRoot, ".letra"), { recursive: true });
		const dependencies = deps();
		vi.mocked(dependencies.resolveHumanActor!).mockReturnValue(null);
		const route = createWorkflowRoutes(dependencies);
		const call = async (method: string, path: string, body?: unknown) => {
			const req = request(method, body === undefined ? "" : JSON.stringify(body));
			const res = response();
			const context = createRequestContext(req, res, new URL(`http://localhost${path}`), { workspaceRoot: tmpRoot!, workspaceDir: join(tmpRoot!, ".letra"), workflow: workflow() });
			expect(await route(context)).toBe(true);
			return { res, body: payload(res) as any };
		};
		const content = { name: "Visual", initialStageId: "draft", stages: [{ id: "draft", transitions: [{ target: "done" }] }, { id: "done", final: true }] };
		const created = await call("POST", "/api/workflow-definitions", { name: "Visual", actor: "human:owner", content });
		const id = created.body.definition.id as string;

		const published = await call("POST", `/api/workflow-definitions/${id}/publish`, { actor: "human:forged-body", expectedRevision: 1, reason: "Try forged body actor" });

		expect(published.res.writeHead).toHaveBeenCalledWith(403, expect.anything());
		expect(published.body).toEqual({ error: "HUMAN_CONFIRMATION_REQUIRED" });
		expect(dependencies.broadcast).not.toHaveBeenCalled();
	});

	it("preserves items and moves items from removed template stages to backlog", async () => {
		const req = request("POST", '{"template":"review-only"}');
		const res = response();
		const writeWorkflow = vi.fn();
		const deps = {
			writeWorkflow,
			resolveActiveFlow: vi.fn(),
			detectWorkspaceName: vi.fn().mockReturnValue("Letra"),
			loadHarness: vi.fn().mockReturnValue(null),
			createFromTemplate: vi.fn().mockReturnValue({
				version: "1.0",
				name: "Letra",
				description: "Workspace settings",
				createdAt: "2026-08-01T00:00:00.000Z",
				updatedAt: "2026-08-17T00:00:00.000Z",
				stages: [
					{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
					{ id: "review", name: "Review", order: 1 },
				],
				items: [],
				locations: [],
				specLinks: {},
				tools: [],
				template: "review-only",
			} satisfies Workflow),
			broadcast: vi.fn(),
		} as unknown as WorkflowRouteDependencies;
		const context = createRequestContext(
			req,
			res,
			new URL("http://localhost/api/workflow/template"),
			{
				workspaceRoot: "C:/Workspace/letra",
				workspaceDir: "C:/Workspace/letra/.letra",
				workflow: workflow(),
			},
		);

		await expect(createWorkflowRoutes(deps)(context)).resolves.toBe(true);

		const persisted = writeWorkflow.mock.calls[0]?.[1]?.workflow as Workflow;
		expect(persisted.items).toEqual([
			expect.objectContaining({ id: "ITEM-1", stage: "backlog" }),
			expect.objectContaining({ id: "ITEM-2", stage: "backlog" }),
		]);
		expect(persisted.locations).toEqual([
			{ id: "loc-1", path: "C:/Workspace/letra", label: "Letra", adapters: [] },
		]);
		expect(persisted.specLinks).toEqual({ "ITEM-2": { path: "workspace-settings" } });
		expect(persisted.tools).toEqual(["opencode"]);
		expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"stage":"backlog"'));
	});

	it("adds multiple project folders as locations and writes links to the same data directory", async () => {
		tmpRoot = join(tmpdir(), `letra-workflow-locations-${Date.now()}`);
		const dataDir = join(tmpRoot, "data-dir");
		const projectA = join(tmpRoot, "project-a");
		const projectB = join(tmpRoot, "project-b");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(projectA, { recursive: true });
		mkdirSync(projectB, { recursive: true });
		writeFileSync(join(projectA, "README.md"), "keep me", "utf-8");
		const wf = workflow();
		wf.locations = [];
		const dependencies = deps();
		const req = request(
			"POST",
			JSON.stringify({
				locations: [
					{ path: projectA, label: "Project A", adapters: ["opencode"] },
					{ path: projectB, label: "Project B" },
				],
			}),
		);
		const res = response();
		const context = createRequestContext(
			req,
			res,
			new URL("http://localhost/api/workflow/locations"),
			{ workspaceRoot: dataDir, workspaceDir: dataDir, workflow: wf },
		);

		await expect(createWorkflowRoutes(dependencies)(context)).resolves.toBe(true);

		expect(readFileSync(join(projectA, ".letra-link"), "utf-8").trim()).toBe(dataDir);
		expect(readFileSync(join(projectB, ".letra-link"), "utf-8").trim()).toBe(dataDir);
		expect(existsSync(join(projectA, "README.md"))).toBe(true);
		expect(wf.locations).toEqual([
			expect.objectContaining({
				path: projectA.replace(/\\/g, "/"),
				label: "Project A",
				adapters: ["opencode"],
			}),
			expect.objectContaining({
				path: projectB.replace(/\\/g, "/"),
				label: "Project B",
				adapters: [],
			}),
		]);
		expect(payload(res)).toEqual({
			locations: [
				expect.objectContaining({ label: "Project A", adapters: ["opencode"] }),
				expect.objectContaining({ label: "Project B", adapters: [] }),
			],
		});
		expect(dependencies.writeWorkflow).toHaveBeenCalled();
	});

	it("repairs a missing location link and removes only the workspace link when deleting a location", async () => {
		tmpRoot = join(tmpdir(), `letra-workflow-repair-${Date.now()}`);
		const dataDir = join(tmpRoot, "data-dir");
		const projectDir = join(tmpRoot, "project");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}", "utf-8");
		const wf = workflow();
		wf.locations = [
			{
				id: "loc-project",
				path: projectDir.replace(/\\/g, "/"),
				label: "Project",
				adapters: [],
			},
		];
		const dependencies = deps();

		const repairReq = request("POST");
		const repairRes = response();
		await expect(
			createWorkflowRoutes(dependencies)(
				createRequestContext(
					repairReq,
					repairRes,
					new URL("http://localhost/api/workflow/locations/loc-project/repair-link"),
					{ workspaceRoot: dataDir, workspaceDir: dataDir, workflow: wf },
				),
			),
		).resolves.toBe(true);

		expect(readFileSync(join(projectDir, ".letra-link"), "utf-8").trim()).toBe(dataDir);
		expect(payload(repairRes)).toEqual(
			expect.objectContaining({
				ok: true,
				dataDir: dataDir.replace(/\\/g, "/"),
			}),
		);

		const deleteReq = request("DELETE");
		const deleteRes = response();
		await expect(
			createWorkflowRoutes(dependencies)(
				createRequestContext(
					deleteReq,
					deleteRes,
					new URL("http://localhost/api/workflow/locations/loc-project"),
					{ workspaceRoot: dataDir, workspaceDir: dataDir, workflow: wf },
				),
			),
		).resolves.toBe(true);

		expect(existsSync(join(projectDir, ".letra-link"))).toBe(false);
		expect(existsSync(join(projectDir, "package.json"))).toBe(true);
		expect(wf.locations).toEqual([]);
		expect(payload(deleteRes)).toEqual({ ok: true, linkRemoved: true });
	});
});
