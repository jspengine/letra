import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HumanSessionGateway } from "./human-session.js";

function response(): ServerResponse {
	return { setHeader: vi.fn() } as unknown as ServerResponse;
}

function request(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
	return { method: "GET", url: "/", headers: { host: "127.0.0.1:3000" }, ...overrides } as IncomingMessage;
}

describe("HumanSessionGateway", () => {
	const workspaceRoot = join(tmpdir(), `letra-human-session-test-${Date.now()}`);
	it("resolves a server-owned human identity from a signed same-origin session", () => {
		const gateway = new HumanSessionGateway(workspaceRoot);
		const res = response();
		gateway.establishNavigationSession(request(), res);
		const setCookie = vi.mocked(res.setHeader).mock.calls[0][1] as string;
		const cookie = setCookie.split(";")[0];
		const actor = gateway.resolveHumanActor(request({ method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", cookie } }));
		expect(actor).toMatch(/^human:local:.+/);
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Strict");
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
