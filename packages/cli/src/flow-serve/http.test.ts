import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { readJson, routeParam, sendError, sendJson } from "./http.js";

function request(body: string): IncomingMessage {
	return Readable.from([body]) as IncomingMessage;
}

function response() {
	return {
		writeHead: vi.fn(),
		end: vi.fn(),
	} as unknown as ServerResponse;
}

describe("flow-serve HTTP helpers", () => {
	it("reads bounded JSON bodies", async () => {
		await expect(readJson<{ name: string }>(request('{"name":"Letra"}'))).resolves.toEqual({
			name: "Letra",
		});
	});

	it("rejects malformed JSON with a stable client error", async () => {
		await expect(readJson(request("{"))).rejects.toEqual(
			expect.objectContaining({
				status: 400,
				message: "Malformed JSON request body",
			}),
		);
	});

	it("rejects oversized bodies", async () => {
		await expect(readJson(request('{"large":true}'), 4)).rejects.toEqual(
			expect.objectContaining({ status: 413 }),
		);
	});

	it("writes JSON success and error responses", () => {
		const success = response();
		sendJson(success, 201, { ok: true });
		expect(success.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
		expect(success.end).toHaveBeenCalledWith('{"ok":true}');

		const failure = response();
		sendError(failure, 400, "Invalid request");
		expect(failure.end).toHaveBeenCalledWith('{"error":"Invalid request"}');
	});

	it("extracts a decoded route parameter only from exact matches", () => {
		expect(routeParam("/api/items/ITEM-1", "/api/items/:id")).toBe("ITEM-1");
		expect(routeParam("/api/specs/my%20spec", "/api/specs/:id")).toBe("my spec");
		expect(routeParam("/api/items/ITEM-1/focus", "/api/items/:id")).toBeNull();
	});
});
