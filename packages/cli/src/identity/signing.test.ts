import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLocalIdentity } from "./service.js";
import { assertSignedOperation, signLocalOperation } from "./signing.js";

const roots: string[] = [];
function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-signing-"));
	roots.push(root);
	writeFileSync(join(root, "workflow.json"), "{}", "utf8");
	return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("local Ed25519 operation proofs", () => {
	it("binds actor, workspace, operation and details, and rejects replay", () => {
		const root = workspace();
		const actor = resolveLocalIdentity(root).id;
		const details = { workflowId: "flow-1", versionNumber: 1, reason: "restore" };
		const proof = signLocalOperation(root, actor, "workflow.rollback", details);
		expect(existsSync(join(root, "identity", "keys", "private.pem"))).toBe(true);
		expect(readFileSync(join(root, "identity", "keys", "private.pem"), "utf8")).toContain("PRIVATE KEY");
		expect(() => assertSignedOperation(root, actor, "workflow.publish", details, proof)).toThrow("SIGNED_OPERATION_INVALID");
		expect(() => assertSignedOperation(root, actor, "workflow.rollback", { ...details, versionNumber: 2 }, proof)).toThrow("SIGNED_OPERATION_INVALID");
		expect(() => assertSignedOperation(root, "human:forged", "workflow.rollback", details, proof)).toThrow("SIGNED_OPERATION_REQUIRED");
		expect(() => assertSignedOperation(root, actor, "workflow.rollback", details, proof)).not.toThrow();
		expect(() => assertSignedOperation(root, actor, "workflow.rollback", details, proof)).toThrow("SIGNED_OPERATION_REPLAYED");
	});

	it("rejects stale proofs and does not bootstrap identity during verification", () => {
		const root = workspace();
		expect(() => assertSignedOperation(root, "human:any", "workflow.rollback", {}, undefined)).toThrow("SIGNED_OPERATION_REQUIRED");
		expect(existsSync(join(root, "identity", "local.json"))).toBe(false);
		const actor = resolveLocalIdentity(root).id;
		const proof = signLocalOperation(root, actor, "workflow.rollback", {});
		expect(() => assertSignedOperation(root, actor, "workflow.rollback", {}, { ...proof, issuedAt: "2020-01-01T00:00:00.000Z" })).toThrow("SIGNED_OPERATION_EXPIRED");
	});
});
