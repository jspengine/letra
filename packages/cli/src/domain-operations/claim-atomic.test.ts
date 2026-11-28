import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { workspaceBusyRefusal } from "../workspace-busy.js";
import { getLetraDir } from "../workspace/resolver.js";
import { claimOperation, directionForOperation } from "./service.js";

// ITEM-58 (spec claim-atomico): a claim never leaves the item half written.

const roots: string[] = [];
const holders: ChildProcess[] = [];
afterEach(() => {
	for (const holder of holders.splice(0)) holder.kill();
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-claim-atomic-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "identity"), { recursive: true });
	writeFileSync(join(root, ".letra", "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "host", createdAt: new Date().toISOString() }));
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
		version: "1.0", name: "Atomic", createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z",
		stages: [{ id: "design", name: "Design", order: 0, zone: "doing" }],
		items: [{ id: "ITEM-1", description: "Atomic claim", stage: "design", createdAt: "2026-11-25T00:00:00.000Z" }],
		tools: [],
	}, null, 2));
	return root;
}

/** Another process takes the workspace lock and keeps it for `ms`. */
async function holdLock(root: string, ms: number): Promise<void> {
	const lock = join(getLetraDir(root), "runtime", "workspace-transaction.lock");
	mkdirSync(join(getLetraDir(root), "runtime"), { recursive: true });
	const script = `const fs=require("fs");fs.writeFileSync(${JSON.stringify(lock)},JSON.stringify({pid:process.pid}),{flag:"wx"});console.log("held");setTimeout(()=>{try{fs.unlinkSync(${JSON.stringify(lock)})}catch{}},${ms});`;
	const holder = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "ignore"] });
	holders.push(holder);
	await new Promise<void>((resolve) => holder.stdout?.once("data", () => resolve()));
}

/** The revision is read first: reading the direction also takes the lock. */
const claim = (root: string, expectedRevision: string) =>
	claimOperation(root, { itemId: "ITEM-1", actor: "analyst", executorId: "codex", capability: "write_spec", reason: "teste", expectedRevision });
const revision = (root: string) => directionForOperation(root, { itemId: "ITEM-1" }).revision;

describe("AC2 — a short wait for a lock held by another process", () => {
	it("claims once the other process releases the lock within the wait", async () => {
		const root = workspace();
		const rev = revision(root);
		await holdLock(root, 300);
		expect(await claim(root, rev)).toMatchObject({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" });
	}, 15_000);
});

describe("AC1/AC3/AC4 — a busy lock refuses cleanly and changes nothing", () => {
	it("refuses with WORKSPACE_BUSY and a retry command, leaving the item unclaimed", async () => {
		const root = workspace();
		const rev = revision(root);
		await holdLock(root, 8000);
		const refusal = await claim(root, rev);
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "WORKSPACE_BUSY", humanRequired: false });
		expect(refusal.nextCommand).toMatch(/^letra operation claim ITEM-1 /);
		const item = JSON.parse(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).items[0];
		expect(item.claimedBy).toBeUndefined();
		// The refusal could not be audited while the lock was held, and still came back.
		expect(refusal.auditId).toBe("audit-unavailable:workspace-busy");
	}, 20_000);
});

describe("AC3 — an escaped busy error becomes a refusal at the CLI", () => {
	it("repeats the same command, quoted for the shell", () => {
		const refusal = workspaceBusyRefusal(["operation", "claim", "ITEM-1", "--reason", "Assume o item"]);
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "WORKSPACE_BUSY", humanRequired: false });
		expect(refusal.nextCommand).toBe('letra operation claim ITEM-1 --reason "Assume o item"');
	});
});

