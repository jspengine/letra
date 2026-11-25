import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowServer } from "../commands/flow-serve.js";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { HumanSessionGateway } from "./human-session.js";

// ITEM-62 (spec board-identidade-canonica): the board acts as the identity of
// the workspace it is showing.

const roots: string[] = [];
const servers: FlowServer[] = [];
afterEach(() => {
	for (const server of servers.splice(0)) server.stop();
	clearWorkspaceCache();
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function dataDir(identity: string): string {
	const dir = mkdtempSync(join(tmpdir(), "letra-board-identity-"));
	roots.push(dir);
	writeFileSync(join(dir, "workflow.json"), JSON.stringify({ version: "1.0", name: "W", createdAt: "", updatedAt: "", stages: [{ id: "backlog", name: "Backlog", order: 0 }], items: [], tools: [] }));
	mkdirSync(join(dir, "identity"), { recursive: true });
	writeFileSync(join(dir, "identity", "local.json"), JSON.stringify({ id: identity, osUser: "owner", hostname: "host", createdAt: new Date().toISOString() }));
	return dir;
}

const base = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
const request = (overrides: Partial<IncomingMessage> = {}) => ({ method: "GET", url: "/", headers: { host: base.host }, ...overrides }) as IncomingMessage;
const response = () => ({ setHeader: vi.fn() }) as unknown as ServerResponse;

describe("AC1 — the session acts as the active workspace's identity", () => {
	it("follows a workspace switch instead of keeping the identity of the first workspace", () => {
		const first = dataDir("human:local:first");
		const second = dataDir("human:local:second");
		let active = first;
		const gateway = new HumanSessionGateway(() => active);
		const res = response();
		gateway.establishNavigationSession(request(), res);
		const cookie = (vi.mocked(res.setHeader).mock.calls[0]?.[1] as string).split(";")[0];
		const post = request({ method: "POST", headers: { ...base, cookie } });
		expect(gateway.resolveHumanActor(post)).toBe("human:local:first");
		active = second;
		expect(gateway.resolveHumanActor(post)).toBe("human:local:second");
	});

	it("a board opened in a folder linked to a workspace uses that workspace's identity", () => {
		const canonical = dataDir("human:local:canonical");
		const project = mkdtempSync(join(tmpdir(), "letra-board-linked-"));
		roots.push(project);
		writeFileSync(join(project, ".letra-link"), `${canonical}\n`);
		const server = new FlowServer(project, 0);
		servers.push(server);
		expect(server.sessionSummary()).toEqual({ workspaceDir: canonical, actor: "human:local:canonical" });
		// AC2: no identity is created in the linked folder itself.
		expect(existsSync(join(project, ".letra", "identity"))).toBe(false);
	});
});

describe("AC3 — startup tells which workspace and identity the board uses", () => {
	it("sessionSummary reflects the workspace after a switch", () => {
		const first = dataDir("human:local:first");
		const second = dataDir("human:local:second");
		const server = new FlowServer(first, 0);
		servers.push(server);
		expect(server.sessionSummary().actor).toBe("human:local:first");
		server.switchWorkspace(second);
		expect(server.sessionSummary()).toEqual({ workspaceDir: second, actor: "human:local:second" });
		expect(JSON.parse(readFileSync(join(second, "identity", "local.json"), "utf8")).id).toBe("human:local:second");
	});
});

