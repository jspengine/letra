import { afterEach, describe, expect, it, vi } from "vitest";
import { installWorkspaceBusyHandler, WORKSPACE_BUSY_ERROR } from "./workspace-busy.js";

// ITEM-58 AC3: the process-level handler answers a busy lock with a refusal
// and leaves every other error with Node's default outcome (exit 1, not 7).

class ExitCalled extends Error {}

type Listener = (...args: unknown[]) => void;
const events = ["uncaughtException", "unhandledRejection"] as const;
const added: Array<[(typeof events)[number], Listener]> = [];
// The overloads of `process.listeners` do not accept a union of event names.
const emitter = process as unknown as NodeJS.EventEmitter;

/** Installs the handler and returns it; only these listeners are removed later. */
function installed(): (error: unknown) => void {
	const before = new Map(events.map((event) => [event, new Set(emitter.listeners(event))]));
	installWorkspaceBusyHandler(["operation", "claim", "ITEM-1"]);
	for (const event of events)
		for (const listener of emitter.listeners(event))
			if (!before.get(event)?.has(listener)) added.push([event, listener as Listener]);
	const handler = added.find(([event]) => event === "uncaughtException")?.[1];
	if (!handler) throw new Error("handler not installed");
	return handler;
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const [event, listener] of added.splice(0)) emitter.removeListener(event, listener);
});

describe("installWorkspaceBusyHandler", () => {
	it("prints the refusal and exits 1 for a busy workspace", () => {
		const exit = vi.spyOn(process, "exit").mockImplementation(() => { throw new ExitCalled(); });
		const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		expect(() => installed()(new Error(WORKSPACE_BUSY_ERROR))).toThrow(ExitCalled);
		expect(exit).toHaveBeenCalledWith(1);
		expect(String(write.mock.calls[0]?.[0])).toContain('"reasonCode": "WORKSPACE_BUSY"');
	});

	it("reports any other error on stderr and exits 1 instead of rethrowing", () => {
		const exit = vi.spyOn(process, "exit").mockImplementation(() => { throw new ExitCalled(); });
		const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const boom = new Error("boom");
		expect(() => installed()(boom)).toThrow(ExitCalled);
		expect(stderr).toHaveBeenCalledWith(boom);
		expect(exit).toHaveBeenCalledWith(1);
	});
});
