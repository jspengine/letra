import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createRequestContext } from "../request-context.js";
import {
	createDiagnosticsRoutes,
	type DiagnosticsRouteDependencies,
} from "./diagnostics-routes.js";

describe("diagnostics routes", () => {
	it("persists health acknowledgement in the request workspace", async () => {
		const req = Readable.from(['{"id":"alert-1"}']) as IncomingMessage;
		req.method = "POST";
		const res = {
			writeHead: vi.fn(),
			end: vi.fn(),
		} as unknown as ServerResponse;
		const saveHealthRecord = vi.fn();
		const engineFor = vi.fn().mockReturnValue({});
		const dependencies = {
			engineFor,
			loadHealthRecord: vi.fn().mockReturnValue({ entries: [] }),
			saveHealthRecord,
			ackEntry: vi.fn().mockReturnValue(true),
			dismissEntry: vi.fn(),
			getSummary: vi.fn(),
			getActiveEntries: vi.fn(),
			runDiagnostics: vi.fn(),
			broadcast: vi.fn(),
			broadcastDiagnostics: vi.fn(),
		} as unknown as DiagnosticsRouteDependencies;
		const context = createRequestContext(req, res, new URL("http://localhost/api/health/ack"), {
			workspaceRoot: "C:\\workspace-c",
			workspaceDir: "C:\\workspace-c\\.letra",
			workflow: null,
		});

		await expect(createDiagnosticsRoutes(dependencies)(context)).resolves.toBe(true);
		expect(engineFor).toHaveBeenCalledWith("C:\\workspace-c");
		expect(saveHealthRecord).toHaveBeenCalledWith(
			"C:\\workspace-c",
			expect.objectContaining({ entries: [] }),
		);
		expect(res.end).toHaveBeenCalledWith('{"acked":"alert-1"}');
	});
});
