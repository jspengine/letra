import { describe, expect, it, vi } from "vitest";
import { FlowServerEvents } from "./events.js";

describe("FlowServerEvents", () => {
	it("broadcasts handoff events", () => {
		const events = new FlowServerEvents();
		const mockWrite = vi.fn();

		const mockReq = { on: vi.fn() } as any;
		const mockRes = {
			writeHead: vi.fn(),
			write: mockWrite,
			destroy: vi.fn(),
		} as any;

		events.handleSse(mockReq, mockRes);

		events.broadcastHandoff({
			itemId: "ITEM-1",
			from: "opencode",
			to: "reviewer",
			summary: "Review code",
			evidence: [],
			timestamp: "2026-08-23T10:00:00Z",
			expiresAt: "2026-08-23T11:00:00Z",
			action: "emitted",
		});

		expect(mockWrite).toHaveBeenCalledWith(
			expect.stringContaining('event: handoff'),
		);
		expect(mockWrite).toHaveBeenCalledWith(
			expect.stringContaining('"action":"emitted"'),
		);
	});

	it("does not broadcast when no clients connected", () => {
		const events = new FlowServerEvents();

		// Should not throw
		events.broadcastHandoff({
			itemId: "ITEM-1",
			from: "opencode",
			to: "reviewer",
			summary: "Review code",
			evidence: [],
			timestamp: "2026-08-23T10:00:00Z",
			expiresAt: "2026-08-23T11:00:00Z",
			action: "emitted",
		});
	});

	it("removes disconnected clients", () => {
		const events = new FlowServerEvents();
		const mockWrite = vi.fn();

		const mockReq = { on: vi.fn() } as any;
		const mockRes = {
			writeHead: vi.fn(),
			write: mockWrite,
			destroy: vi.fn(),
		} as any;

		events.handleSse(mockReq, mockRes);

		// Simulate disconnect
		const closeCallback = mockReq.on.mock.calls.find(
			(call: any[]) => call[0] === "close",
		)?.[1];
		if (closeCallback) closeCallback();

		// Should not write to disconnected client
		events.broadcastHandoff({
			itemId: "ITEM-1",
			from: "opencode",
			to: "reviewer",
			summary: "Review code",
			evidence: [],
			timestamp: "2026-08-23T10:00:00Z",
			expiresAt: "2026-08-23T11:00:00Z",
			action: "emitted",
		});

		expect(mockWrite).not.toHaveBeenCalledWith(
			expect.stringContaining('event: handoff'),
		);
	});
});
