import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HumanSessionGateway } from "./human-session.js";

function response(): ServerResponse {
	return { setHeader: vi.fn() } as unknown as ServerResponse;
}

function request(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
	return { method: "GET", url: "/", headers: { host: "127.0.0.1:3000" }, ...overrides } as IncomingMessage;
}

describe("HumanSessionGateway", () => {
	const workspaceRoot = join(tmpdir(), `letra-human-session-test-${Date.now()}`);
	beforeAll(() => {
		mkdirSync(workspaceRoot, { recursive: true });
		writeFileSync(join(workspaceRoot, "workflow.json"), "{}", "utf8");
	});
	afterAll(() => rmSync(workspaceRoot, { recursive: true, force: true }));
	it("resolves a server-owned human identity from a signed same-origin session", () => {
		const gateway = new HumanSessionGateway(workspaceRoot);
		const res = response();
		gateway.establishNavigationSession(request(), res);
		const setCookie = vi.mocked(res.setHeader).mock.calls[0][1] as string;
		const cookie = setCookie.split(";")[0];
		const actor = gateway.resolveHumanActor(request({ method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", cookie } }));
		expect(actor).toMatch(/^human:local:.+/);
		const identity = JSON.parse(readFileSync(join(workspaceRoot, "identity", "local.json"), "utf8"));
		expect(actor).toBe(identity.id);
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Strict");
	});

	it("replaces a session cookie issued by a previous server on navigation (ITEM-36)", () => {
		const base = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
		const before = new HumanSessionGateway(workspaceRoot);
		const first = response();
		before.establishNavigationSession(request(), first);
		const staleCookie = (vi.mocked(first.setHeader).mock.calls[0][1] as string).split(";")[0];

		// Server restart: new secret and empty session map.
		const restarted = new HumanSessionGateway(workspaceRoot);
		expect(restarted.resolveHumanActor(request({ method: "POST", headers: { ...base, cookie: staleCookie } }))).toBeNull();

		const reload = response();
		restarted.establishNavigationSession(request({ headers: { host: base.host, cookie: staleCookie } }), reload);
		expect(reload.setHeader).toHaveBeenCalledTimes(1);
		const freshCookie = (vi.mocked(reload.setHeader).mock.calls[0][1] as string).split(";")[0];
		expect(freshCookie).not.toBe(staleCookie);
		expect(restarted.resolveHumanActor(request({ method: "POST", headers: { ...base, cookie: freshCookie } }))).toMatch(/^human:local:.+/);
	});

	it("keeps a live session instead of reissuing it on every navigation", () => {
		const gateway = new HumanSessionGateway(workspaceRoot);
		const first = response();
		gateway.establishNavigationSession(request(), first);
		const cookie = (vi.mocked(first.setHeader).mock.calls[0][1] as string).split(";")[0];
		const again = response();
		gateway.establishNavigationSession(request({ headers: { host: "127.0.0.1:3000", cookie } }), again);
		expect(again.setHeader).not.toHaveBeenCalled();
	});

	it("rejects forged, missing, and cross-origin sessions", () => {
		const gateway = new HumanSessionGateway(workspaceRoot);
		const base = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
		expect(gateway.resolveHumanActor(request({ method: "POST", headers: base }))).toBeNull();
		expect(gateway.resolveHumanActor(request({ method: "POST", headers: { ...base, cookie: "letra_human_session=forged.signature" } }))).toBeNull();
		const res = response();
		gateway.establishNavigationSession(request(), res);
		const cookie = (vi.mocked(res.setHeader).mock.calls[0][1] as string).split(";")[0];
		expect(gateway.resolveHumanActor(request({ method: "POST", headers: { host: base.host, origin: "https://evil.example", cookie } }))).toBeNull();
	});
});
