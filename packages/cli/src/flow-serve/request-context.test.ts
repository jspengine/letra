import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createRequestContext } from "./request-context.js";

describe("createRequestContext", () => {
	it("binds one immutable request to one explicit workspace root", () => {
		const context = createRequestContext(
			{ method: "PATCH" } as IncomingMessage,
			{} as ServerResponse,
			new URL("http://localhost/api/workflow?workspace=C%3A%5Cwork"),
			{
				workspaceRoot: "C:\\work",
				workspaceDir: "C:\\work\\repository",
				workflow: null,
			},
		);

		expect(context).toMatchObject({
			path: "/api/workflow",
			method: "PATCH",
			workspaceRoot: "C:\\work",
			workspaceDir: "C:\\work\\repository",
		});
		expect(Object.isFrozen(context)).toBe(true);
	});
});
