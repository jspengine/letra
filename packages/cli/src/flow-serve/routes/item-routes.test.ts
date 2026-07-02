import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../commands/flow-init.js";
import { createRequestContext } from "../request-context.js";
import {
	createItemRoutes,
	type ItemRouteDependencies,
} from "./item-routes.js";

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
		logEntry: vi.fn(),
		resolveActiveFlow: vi.fn().mockReturnValue({ flow: null, warnings: [] }),
		broadcast: vi.fn(),
		fireWebhooks: vi.fn().mockResolvedValue(undefined),
	} as unknown as ItemRouteDependencies;
	return { deps, writeWorkflow, loadHealthRecord };
}

describe("item routes", () => {
	it("owns the single item-alert route", async () => {
		const { deps, loadHealthRecord } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("GET"),
			res,
			new URL("http://localhost/api/items/alerts"),
			{ workspaceRoot: "C:\\workspace-a", workspaceDir: "C:\\workspace-a\\.letra", workflow: workflow() },
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
			{ workspaceRoot: "C:\\workspace-b", workspaceDir: "C:\\workspace-b\\.letra", workflow: workflow() },
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
			{ workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: workflow() },
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith('{"error":"Malformed JSON request body"}');
	});
});
