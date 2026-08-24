import { describe, expect, it, vi } from "vitest";
import { createHandoffRoutes, type HandoffRouteDependencies } from "./handoff-routes.js";

function createRequestContext(path: string, method = "GET") {
	const url = new URL(path, "http://localhost:3000");
	return {
		req: { url: url.pathname + url.search, method, headers: { host: "localhost:3000" } } as any,
		res: { writeHead: vi.fn(), end: vi.fn() } as any,
		path: url.pathname,
		method,
		workspaceRoot: "/tmp/test",
	};
}

describe("handoff routes", () => {
	it("returns pending handoffs for all agents", async () => {
		const handoffs = [
			{
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Review code",
				evidence: [],
				timestamp: "2026-08-23T10:00:00Z",
				expiresAt: "2026-08-23T11:00:00Z",
			},
		];

		const deps: HandoffRouteDependencies = {
			getPendingHandoffs: vi.fn().mockReturnValue(handoffs),
		};

		const handler = createHandoffRoutes(deps);
		const context = createRequestContext("/api/handoff/pending");

		const result = await handler(context as any);
		expect(result).toBe(true);
		expect(deps.getPendingHandoffs).toHaveBeenCalledWith(undefined);
	});

	it("filters handoffs by agent ID", async () => {
		const handoffs = [
			{
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Review code",
				evidence: [],
				timestamp: "2026-08-23T10:00:00Z",
				expiresAt: "2026-08-23T11:00:00Z",
			},
		];

		const deps: HandoffRouteDependencies = {
			getPendingHandoffs: vi.fn().mockReturnValue(handoffs),
		};

		const handler = createHandoffRoutes(deps);
		const context = createRequestContext("/api/handoff/pending?agent=reviewer");

		const result = await handler(context as any);
		expect(result).toBe(true);
		expect(deps.getPendingHandoffs).toHaveBeenCalledWith("reviewer");
	});

	it("ignores non-handoff paths", async () => {
		const deps: HandoffRouteDependencies = {
			getPendingHandoffs: vi.fn().mockReturnValue([]),
		};

		const handler = createHandoffRoutes(deps);
		const context = createRequestContext("/api/workflow", "GET");

		const result = await handler(context as any);
		expect(result).toBe(false);
	});

	it("ignores non-GET methods", async () => {
		const deps: HandoffRouteDependencies = {
			getPendingHandoffs: vi.fn().mockReturnValue([]),
		};

		const handler = createHandoffRoutes(deps);
		const context = createRequestContext("/api/handoff/pending", "POST");

		const result = await handler(context as any);
		expect(result).toBe(false);
	});
});
