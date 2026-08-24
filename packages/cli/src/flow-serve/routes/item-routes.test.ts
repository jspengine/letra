import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../commands/flow-init.js";
import { createRequestContext } from "../request-context.js";
import { createItemRoutes, type ItemRouteDependencies } from "./item-routes.js";

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Test",
		createdAt: "2026-07-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "done", name: "Done", order: 1, zone: "done" },
		],
		items: [],
		tools: [],
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

function dependencies() {
	const writeWorkflow = vi.fn();
	const logEntry = vi.fn();
	const loadHealthRecord = vi.fn().mockReturnValue({
		entries: [
			{ id: "drift_ITEM-56_spec", status: "novo" },
			{ id: "other_ITEM-56_test", status: "novo" },
			{ id: "old_ITEM-56_test", status: "resolvido" },
		],
	});
	const deps = {
		writeWorkflow,
		loadHealthRecord,
		writeFocusFile: vi.fn(),
		logEntry,
		resolveActiveFlow: vi.fn().mockReturnValue({ flow: null, warnings: [] }),
		broadcast: vi.fn(),
		fireWebhooks: vi.fn().mockResolvedValue(undefined),
	} as unknown as ItemRouteDependencies;
	return { deps, writeWorkflow, loadHealthRecord, logEntry };
}

function configureHumanGate(
	deps: ItemRouteDependencies,
	decisions: Record<string, string> | null = {
		approve: "next",
		"request-changes": "previous",
		reject: "first",
	},
) {
	vi.mocked(deps.resolveActiveFlow).mockReturnValue({
		workflow: null,
		harness: null,
		template: null,
		flow: {
			id: "test-flow",
			source: "workflow-template",
			harnessVersion: "v0.1.3",
			templateVersion: "0.1.3",
			name: "Test flow",
			roles: [],
			warnings: [],
			stages: [
				{
					id: "backlog",
					name: "Backlog",
					order: 0,
					zone: "todo",
					roleIds: [],
					roles: [],
					agents: [],
					gate: null,
					provenance: "harness",
				},
				{
					id: "review",
					name: "Review",
					order: 1,
					zone: "doing",
					roleIds: [],
					roles: [],
					agents: [],
					gate: {
						id: "human-review",
						name: "Human Review",
						type: "human",
						blocking: true,
						description: "Human decision required",
						decisions: decisions ?? undefined,
					},
					provenance: "harness",
				},
				{
					id: "code",
					name: "Code",
					order: 2,
					zone: "doing",
					roleIds: [],
					roles: [],
					agents: [],
					gate: null,
					provenance: "harness",
				},
			],
		},
	});
}

function workflowAtGate(): Workflow {
	const value = workflow();
	value.stages = [
		{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
		{ id: "review", name: "Review", order: 1, zone: "doing" },
		{ id: "code", name: "Code", order: 2, zone: "doing" },
	];
	value.items = [
		{
			id: "ITEM-1",
			description: "First item",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
		},
		{
			id: "ITEM-2",
			description: "Second item",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
			spec: "second-item",
		},
	];
	return value;
}

describe("item routes", () => {
	it("owns the single item-alert route", async () => {
		const { deps, loadHealthRecord } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("GET"),
			res,
			new URL("http://localhost/api/items/alerts"),
			{
				workspaceRoot: "C:\\workspace-a",
				workspaceDir: "C:\\workspace-a\\.letra",
				workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(loadHealthRecord).toHaveBeenCalledWith("C:\\workspace-a");
		expect(res.end).toHaveBeenCalledWith('{"itemAlerts":{"ITEM-56":2}}');
	});

	it("persists item mutations in the request workspace", async () => {
		const { deps, writeWorkflow } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("POST", '{"id":"ITEM-9","description":"Extract routes","stage":"backlog"}'),
			res,
			new URL("http://localhost/api/items"),
			{
				workspaceRoot: "C:\\workspace-b",
				workspaceDir: "C:\\workspace-b\\.letra",
				workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(writeWorkflow).toHaveBeenCalledWith(
			"C:\\workspace-b",
			expect.objectContaining({ source: "web-ui", primaryItemId: "ITEM-9" }),
		);
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	it("returns the stable malformed-body response", async () => {
		const { deps, writeWorkflow } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("POST", "{"),
			res,
			new URL("http://localhost/api/items"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith('{"error":"Malformed JSON request body"}');
	});

	it("applies and audits a gate decision for the requested item only", async () => {
		const { deps, writeWorkflow, logEntry } = dependencies();
		configureHumanGate(deps);
		const value = workflowAtGate();
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"approve"}'),
			res,
			new URL("http://localhost/api/items/ITEM-2/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: value,
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(value.items[0].stage).toBe("review");
		expect(value.items[1].stage).toBe("code");
		expect(writeWorkflow).toHaveBeenCalledWith(
			"C:\\workspace",
			expect.objectContaining({
				source: "web-ui-gate-decision",
				primaryItemId: "ITEM-2",
			}),
		);
		expect(logEntry).toHaveBeenCalledWith(
			"C:\\workspace",
			"decision",
			expect.stringContaining("approve"),
			expect.objectContaining({
				itemId: "ITEM-2",
				details: expect.objectContaining({
					gateId: "human-review",
					decision: "approve",
					from: "review",
					to: "code",
					by: "human:web-ui",
				}),
			}),
		);
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	it("requires a reason for request-changes and reject", async () => {
		const { deps, writeWorkflow, logEntry } = dependencies();
		configureHumanGate(deps);
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"reject"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflowAtGate(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(logEntry).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
	});

	it("rejects safely when the harness does not define decision targets", async () => {
		const { deps, writeWorkflow } = dependencies();
		configureHumanGate(deps, null);
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"approve"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflowAtGate(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(422, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith(expect.stringContaining("does not define"));
	});

	it("prevents the generic patch route from bypassing a human gate", async () => {
		const { deps, writeWorkflow, logEntry } = dependencies();
		configureHumanGate(deps);
		const value = workflowAtGate();
		const res = response();
		const context = createRequestContext(
			request("PATCH", '{"stage":"code"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: value,
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(value.items[0].stage).toBe("review");
		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(logEntry).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(422, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith(expect.stringContaining("decisão humana explícita"));
	});
});
