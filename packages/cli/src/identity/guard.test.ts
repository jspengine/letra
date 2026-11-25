import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { assertOperationLevel, OPERATION_REQUIRED_LEVELS, requireLocalHumanSafe, requireLocalHumanStrict } from "./guard.js";
import { signLocalOperation } from "./signing.js";
import { resolveLocalIdentity } from "./service.js";
import { getLetraDir } from "../workspace/resolver.js";

function tmpWorkspace(): string {
	const root = join(tmpdir(), `letra-guard-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
	mkdirSync(join(root, ".letra", "identity"), { recursive: true });
	return root;
}

function createIdentity(root: string) {
	const id = resolveLocalIdentity(root);
	// resolveLocalIdentity creates the file — now it exists
	return id;
}

describe("guard — GAP 2 identity helpers", () => {
	it("declares local and signed assurance for critical mutations", () => {
		expect(OPERATION_REQUIRED_LEVELS).toMatchObject({
			"workflow.transition.force": "local",
			"workflow.activate": "local",
			"gate.decision": "signed",
			"workflow.publish": "local",
			"workflow.rollback": "signed",
		});
	});

	it("accepts a bound signed gate decision only for its exact payload", () => {
		const root = tmpWorkspace();
		const actor = createIdentity(root).id;
		const details = { itemId: "ITEM-1", decision: "approve", expectedRevision: "sha256:test", reason: "Approved" };
		const proof = signLocalOperation(root, actor, "gate.decision", details);
		expect(() => assertOperationLevel(root, actor, OPERATION_REQUIRED_LEVELS["gate.decision"], { operation: "gate.decision", details: { ...details, decision: "reject" }, proof })).toThrow("SIGNED_OPERATION_INVALID");
		expect(() => assertOperationLevel(root, actor, OPERATION_REQUIRED_LEVELS["gate.decision"], { operation: "gate.decision", details, proof })).not.toThrow();
		rmSync(root, { recursive: true, force: true });
	});
	it("assertOperationLevel: rejects local assurance without a registry", () => {
		const root = tmpWorkspace();
		expect(() => assertOperationLevel(root, "mcp:opencode", "local")).toThrow("LOCAL_IDENTITY_REQUIRED");
		rmSync(root, { recursive: true, force: true });
	});

	it("assertOperationLevel: throws for non-matching actor when identity exists", () => {
		const root = tmpWorkspace();
		const identity = createIdentity(root);
		expect(() => assertOperationLevel(root, "mcp:opencode", "local")).toThrow("OPERATION_LEVEL_REQUIRED");
		expect(() => assertOperationLevel(root, identity.id, "local")).not.toThrow();
		rmSync(root, { recursive: true, force: true });
	});

	it("does not grant authority to an actor ID derived from the operating-system username", () => {
		const root = tmpWorkspace();
		const identity = createIdentity(root);
		expect(() => assertOperationLevel(root, `human:${identity.osUser}`, "local")).toThrow("OPERATION_LEVEL_REQUIRED");
		expect(() => assertOperationLevel(root, identity.id, "local")).not.toThrow();
		rmSync(root, { recursive: true, force: true });
	});

	it("fails closed when the local identity registry is corrupt", () => {
		const root = tmpWorkspace();
		const path = join(getLetraDir(root), "identity", "local.json");
		writeFileSync(path, "{broken", "utf8");
		expect(() => assertOperationLevel(root, "human:local:forged", "local")).toThrow("LOCAL_IDENTITY_INVALID");
		expect(requireLocalHumanSafe(root, "human:local:forged", "claim")).toContain("HUMAN_ACTOR_REQUIRED");
		expect(readFileSync(path, "utf8")).toBe("{broken");
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanStrict: accepts verified human:local actor when identity exists", () => {
		const root = tmpWorkspace();
		const identity = createIdentity(root);
		const err = requireLocalHumanStrict(root, identity.id, "gate_decision");
		expect(err).toBeNull();
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanStrict: rejects mcp:* even without identity (security-critical ops)", () => {
		const root = tmpWorkspace();
		// No identity file — still reject, because security-critical ops always need human:
		const err = requireLocalHumanStrict(root, "mcp:opencode", "activate_work");
		expect(err).not.toBeNull();
		expect(err!).toContain("HUMAN_ACTOR_REQUIRED");
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanStrict: rejects actor without human: prefix", () => {
		const root = tmpWorkspace();
		const err = requireLocalHumanStrict(root, "implementer", "activate_work");
		expect(err).not.toBeNull();
		expect(err!).toContain("HUMAN_ACTOR_REQUIRED");
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanStrict: rejects human:actor that doesn't match registered identity", () => {
		const root = tmpWorkspace();
		const identity = createIdentity(root);
		// Another human actor that's not the registered one
		const err = requireLocalHumanStrict(root, "human:attacker", "gate_decision");
		expect(err).not.toBeNull();
		expect(err!).toContain("não corresponde");
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanSafe: rejects mcp:* when no identity exists", () => {
		const root = tmpWorkspace();
		const err = requireLocalHumanSafe(root, "mcp:opencode", "claim");
		expect(err).toContain("HUMAN_ACTOR_REQUIRED");
		rmSync(root, { recursive: true, force: true });
	});

	it("requireLocalHumanSafe: rejects mcp:* when identity exists", () => {
		const root = tmpWorkspace();
		createIdentity(root);
		const err = requireLocalHumanSafe(root, "mcp:opencode", "claim");
		expect(err).not.toBeNull();
		expect(err!).toContain("HUMAN_ACTOR_REQUIRED");
		rmSync(root, { recursive: true, force: true });
	});
});
