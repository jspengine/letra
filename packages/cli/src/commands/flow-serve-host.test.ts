import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveWorkflow } from "./flow-init.js";
import { BOARD_HOST, FlowServer } from "./flow-serve.js";

// ITEM-8 (spec board-so-localhost): the board only accepts local connections.

const cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			probe.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
		});
	});
}

/** Resolves true when a TCP connection to host:port is accepted. */
function canConnect(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		socket.setTimeout(1500);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
		socket.once("timeout", () => {
			socket.destroy();
			resolve(false);
		});
	});
}

/** A non-loopback IPv4 address of this machine, if it has one. */
function lanAddress(): string | undefined {
	return Object.values(networkInterfaces())
		.flat()
		.find((entry) => entry && entry.family === "IPv4" && !entry.internal)?.address;
}

async function startBoard(): Promise<number> {
	const root = mkdtempSync(join(tmpdir(), "letra-board-host-"));
	mkdirSync(join(root, ".letra"), { recursive: true });
	saveWorkflow(root, { version: "1.0", name: "Host", createdAt: "", updatedAt: "", stages: [{ id: "backlog", name: "Backlog", order: 0 }], items: [], tools: [] });
	const port = await freePort();
	const server = new FlowServer(root, port);
	await server.start();
	cleanups.push(() => {
		server.stop();
		rmSync(root, { recursive: true, force: true });
	});
	return port;
}

describe("AC1 — loopback only", () => {
	it("binds to 127.0.0.1", () => {
		expect(BOARD_HOST).toBe("127.0.0.1");
	});

	it("accepts 127.0.0.1 and refuses the machine's network address", async () => {
		const port = await startBoard();
		expect(await canConnect("127.0.0.1", port)).toBe(true);
		const lan = lanAddress();
		if (lan) expect(await canConnect(lan, port)).toBe(false);
	});
});
