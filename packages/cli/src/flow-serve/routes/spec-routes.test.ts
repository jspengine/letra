import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../commands/flow-init.js";
import { createRequestContext } from "../request-context.js";
import { createSpecRoutes, type SpecRouteDependencies } from "./spec-routes.js";

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Test",
		createdAt: "2026-07-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		stages: [],
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
	return { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
}

function dependencies() {
	const writeSpec = vi.fn();
	const writeWorkflow = vi.fn();
	return {
		deps: {
			loadResolvedSpecs: vi.fn().mockReturnValue([]),
			writeSpec,
			clearSpec: vi.fn(),
			validateSpec: vi.fn().mockReturnValue({ id: "auth", issues: [], valid: true }),
			writeWorkflow,
			broadcast: vi.fn(),
		} as unknown as SpecRouteDependencies,
		writeSpec,
		writeWorkflow,
	};
}

describe("spec routes", () => {
	it("writes spec content and workflow links through explicit gateways", async () => {
		const { deps, writeSpec, writeWorkflow } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("POST", '{"id":"auth","content":"# Spec"}'),
			res,
			new URL("http://localhost/api/specs"),
			{ workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: workflow() },
		);

		await expect(createSpecRoutes(deps)(context)).resolves.toBe(true);
		expect(writeSpec).toHaveBeenCalledWith("C:\\workspace\\.letra", "auth", "# Spec");
		expect(writeWorkflow).toHaveBeenCalledWith(
			"C:\\workspace",
			expect.objectContaining({ source: "web-ui" }),
		);
	});

	it("delegates validation to the spec service", async () => {
		const { deps } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("POST"),
			res,
			new URL("http://localhost/api/specs/auth/validate"),
			{ workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: null },
		);

		await expect(createSpecRoutes(deps)(context)).resolves.toBe(true);
		expect(deps.validateSpec).toHaveBeenCalledWith("C:\\workspace\\.letra", "auth");
		expect(res.end).toHaveBeenCalledWith('{"id":"auth","issues":[],"valid":true}');
	});
});
