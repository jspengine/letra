import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { logEntry } from "../session-log.js";
import { GateChecker } from "./gate-checker.js";
import type { Gate, HarnessManifest } from "./types.js";

const roots: string[] = [];

function fixture(): string {
	const root = join(tmpdir(), `letra-gate-checker-${Date.now()}`);
	mkdirSync(root, { recursive: true });
	roots.push(root);
	return root;
}

function writeGateFile(root: string, gateId: string, content: string) {
	const dir = join(root, ".letra", "harness", "gates");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${gateId}.yaml`), content);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function makeManifest(gates: Record<string, Gate> = {}): HarnessManifest {
	return {
		version: "0.2.0",
		flows: {},
		gates,
		roles: {},
		policies: {},
	};
}

function declarativeBuiltins(): HarnessManifest {
	return makeManifest({
		"has-spec-file": { id: "has-spec-file", name: "Spec", type: "automated", blocking: true, description: "Spec", check_type: "spec-linked" },
		"all-acs-passing": { id: "all-acs-passing", name: "ACs", type: "automated", blocking: true, description: "ACs", check_type: "acceptance-complete" },
	});
}

describe("GateChecker", () => {
	describe("checkHasSpecFile", () => {
		it("returns allowed when item has linked spec dir", () => {
			const root = fixture();
			mkdirSync(join(root, ".letra", "specs", "spec-1"), { recursive: true });

			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("has-spec-file", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				spec: "spec-1",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("returns blocked when item has no spec", () => {
			const root = fixture();
			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("has-spec-file", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Item sem spec vinculada");
		});

		it("returns blocked when spec dir does not exist", () => {
			const root = fixture();
			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("has-spec-file", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				spec: "missing-spec",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("missing-spec");
		});
	});

	describe("checkAllAcsPassing", () => {
		it("returns blocked when spec has pending ACs", () => {
			const root = fixture();
			mkdirSync(join(root, ".letra", "specs", "spec-1"), { recursive: true });
			writeFileSync(
				join(root, ".letra", "specs", "spec-1", "spec.md"),
				"# Spec\n\n## Acceptance Criteria\n- [ ] **AC1**: pending\n- [x] **AC2**: done\n",
			);

			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("all-acs-passing", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				spec: "spec-1",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("1 AC(s) pendente(s)");
		});

		it("returns blocked when done AC count exceeds logged ac_done entries", () => {
			const root = fixture();
			mkdirSync(join(root, ".letra", "specs", "spec-1"), { recursive: true });
			writeFileSync(
				join(root, ".letra", "specs", "spec-1", "spec.md"),
				"# Spec\n\n## Acceptance Criteria\n- [x] **AC1**: done\n- [x] **AC2**: done without log\n",
			);

			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("all-acs-passing", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				spec: "spec-1",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("sem confirmação");
		});

		it("returns allowed when all ACs done and logged", () => {
			const root = fixture();
			mkdirSync(join(root, ".letra", "specs", "spec-1"), { recursive: true });
			writeFileSync(
				join(root, ".letra", "specs", "spec-1", "spec.md"),
				"# Spec\n\n## Acceptance Criteria\n- [x] **AC1**: done\n- [x] **AC2**: done\n",
			);
			const item = {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				spec: "spec-1",
				createdAt: new Date().toISOString(),
			} as any;
			logEntry(root, "ac_done", "AC1 done", { itemId: item.id, acId: "AC1" });
			logEntry(root, "ac_done", "AC2 done", { itemId: item.id, acId: "AC2" });

			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("all-acs-passing", item);
			expect(result.allowed).toBe(true);
		});

		it("returns blocked when spec file is missing", () => {
			const root = fixture();
			const checker = new GateChecker(root, declarativeBuiltins());
			const result = checker.check("all-acs-passing", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				spec: "missing-spec",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("missing-spec");
		});
	});

	describe("check (data-driven from manifest)", () => {
		it("fails closed for unknown gate ids", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest());
			const result = checker.check("unknown-gate", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result).toMatchObject({ allowed: false, reasonCode: "GATE_NOT_FOUND" });
		});

		it("blocks human gate when not approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"custom-human",
				"id: custom-human\ntype: human\nblocking: true\nstatus: pending\n",
			);
			const manifest = makeManifest({
				"custom-human": {
					id: "custom-human",
					name: "Custom Human",
					type: "human",
					blocking: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("custom-human", {
				id: "ITEM-1",
				description: "test",
				stage: "review",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("pendente");
		});

		it("allows human gate when approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"custom-human",
				"id: custom-human\ntype: human\nblocking: true\nstatus: approved\n",
			);
			const manifest = makeManifest({
				"custom-human": {
					id: "custom-human",
					name: "Custom Human",
					type: "human",
					blocking: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("custom-human", {
				id: "ITEM-1",
				description: "test",
				stage: "review",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("blocks automated gate when not approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"auto-check",
				"id: auto-check\ntype: automated\nblocking: true\nstatus: pending\n",
			);
			const manifest = makeManifest({
				"auto-check": {
					id: "auto-check",
					name: "Auto Check",
					type: "automated",
					blocking: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("auto-check", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
		});

		it("allows automated gate when approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"auto-check",
				"id: auto-check\ntype: automated\nblocking: true\nstatus: approved\n",
			);
			const manifest = makeManifest({
				"auto-check": {
					id: "auto-check",
					name: "Auto Check",
					type: "automated",
					blocking: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("auto-check", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("blocks external gate when not approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"ext-gate",
				"id: ext-gate\ntype: external\nblocking: true\nstatus: pending\n",
			);
			const manifest = makeManifest({
				"ext-gate": {
					id: "ext-gate",
					name: "External Gate",
					type: "external",
					blocking: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("ext-gate", {
				id: "ITEM-1",
				description: "test",
				stage: "security",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("externa");
		});

		it("uses custom decision label from gate YAML", () => {
			const root = fixture();
			writeGateFile(
				root,
				"spec-review",
				'id: spec-review\ntype: human\nblocking: true\nstatus: pending\ndecisions:\n  approve: "Spec approved by lead"\n',
			);
			const manifest = makeManifest({
				"spec-review": {
					id: "spec-review",
					name: "Spec Review",
					type: "human",
					blocking: true,
					description: "Test",
					decisions: { approve: "Spec approved by lead" },
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.check("spec-review", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Spec approved by lead");
		});

		it("selects built-in behavior by declarative check_type rather than gate id", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest({
				"arbitrary-spec-check": { id: "arbitrary-spec-check", name: "Spec", type: "automated", blocking: true, description: "Spec", check_type: "spec-linked" },
			}));

			const specResult = checker.check("arbitrary-spec-check", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			} as any);
			expect(specResult.allowed).toBe(false);
			expect(specResult.reason).toContain("Item sem spec vinculada");
		});

		it("uses validation semantics with an arbitrary gate id", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest({
				orion: { id: "orion", name: "Orion", type: "automated", blocking: true, description: "Validation", check_type: "validation" },
			}));
			const result = checker.check("orion", { id: "ITEM-1", description: "test", stage: "forge", createdAt: new Date().toISOString() } as any);
			expect(result).toMatchObject({ allowed: false, reasonCode: "VALIDATION_EVIDENCE_MISSING" });
		});

		it("fails closed for unsupported declarative checks", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest({
				atlas: { id: "atlas", name: "Atlas", type: "automated", blocking: true, description: "Unknown", check_type: "unknown" as any },
			}));
			expect(checker.check("atlas", { id: "ITEM-1", description: "test", stage: "forge", createdAt: new Date().toISOString() } as any)).toMatchObject({ allowed: false, reasonCode: "GATE_CHECK_UNSUPPORTED" });
		});

		it("runs a configured security pre-check for an arbitrarily named human gate", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest({
				atlas: { id: "atlas", name: "Atlas", type: "human", blocking: true, description: "Human", pre_check: "security-scoped" },
			}));
			expect(checker.check("atlas", { id: "ITEM-1", description: "test", stage: "forge", createdAt: new Date().toISOString() } as any)).toMatchObject({ allowed: false, reasonCode: "SECURITY_REVIEW_REQUIRED" });
		});
	});

	describe("checkBlocksHandoff (manifest-driven)", () => {
		it("returns true when manifest gate has blocksHandoff: true", () => {
			const root = fixture();
			const manifest = makeManifest({
				"spec-approved": {
					id: "spec-approved",
					name: "Spec Approved",
					type: "human",
					blocking: true,
					blocksHandoff: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			expect(checker.checkBlocksHandoff("spec-approved")).toBe(true);
		});

		it("returns false when manifest gate has blocksHandoff: false", () => {
			const root = fixture();
			const manifest = makeManifest({
				"code-reviewed": {
					id: "code-reviewed",
					name: "Code Reviewed",
					type: "automated",
					blocking: true,
					blocksHandoff: false,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			expect(checker.checkBlocksHandoff("code-reviewed")).toBe(false);
		});

		it("returns false when gate does not exist", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest());
			expect(checker.checkBlocksHandoff("nonexistent")).toBe(false);
		});

		it("falls back to disk when manifest has no gate", () => {
			const root = fixture();
			writeGateFile(
				root,
				"disk-only",
				"id: disk-only\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
			);

			const checker = new GateChecker(root, makeManifest());
			expect(checker.checkBlocksHandoff("disk-only")).toBe(true);
		});
	});

	describe("checkHandoffAllowed", () => {
		it("fails closed when a handoff gate does not exist", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest());
			const result = checker.checkHandoffAllowed("nonexistent", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result).toMatchObject({ allowed: false, reasonCode: "GATE_NOT_FOUND", blocksHandoff: true });
		});

		it("allows handoff when gate has no gateId", () => {
			const root = fixture();
			const checker = new GateChecker(root, makeManifest());
			const result = checker.checkHandoffAllowed("", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("blocks handoff when gate blocksHandoff and is not approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"spec-approved",
				"id: spec-approved\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
			);
			const manifest = makeManifest({
				"spec-approved": {
					id: "spec-approved",
					name: "Spec Approved",
					type: "human",
					blocking: true,
					blocksHandoff: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.checkHandoffAllowed("spec-approved", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.blocksHandoff).toBe(true);
			expect(result.reason).toContain("spec-approved");
		});

		it("allows handoff when gate blocksHandoff but is approved", () => {
			const root = fixture();
			writeGateFile(
				root,
				"spec-approved",
				"id: spec-approved\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: approved\n",
			);
			const manifest = makeManifest({
				"spec-approved": {
					id: "spec-approved",
					name: "Spec Approved",
					type: "human",
					blocking: true,
					blocksHandoff: true,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.checkHandoffAllowed("spec-approved", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

	it("allows handoff when gate does not block handoff", () => {
			const root = fixture();
			writeGateFile(
				root,
				"code-reviewed",
				"id: code-reviewed\ntype: automated\nblocking: true\nblocksHandoff: false\nstatus: pending\n",
			);
			const manifest = makeManifest({
				"code-reviewed": {
					id: "code-reviewed",
					name: "Code Reviewed",
					type: "automated",
					blocking: true,
					blocksHandoff: false,
					description: "Test",
				},
			});

			const checker = new GateChecker(root, manifest);
			const result = checker.checkHandoffAllowed("code-reviewed", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				createdAt: new Date().toISOString(),
			} as any);

		expect(result.allowed).toBe(true);
	});

	it("resolves versioned gate runtime in an externalized workspace", () => {
		const root = fixture();
		const dir = join(root, ".letra", "harness", "v0.2.0", "gates");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "code-reviewed.yaml"), "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
		const manifest = makeManifest({ "code-reviewed": { id: "code-reviewed", name: "Code Reviewed", type: "automated", blocking: true, blocksHandoff: false, description: "Test" } });
		const now = new Date();
		const result = new GateChecker(root, manifest).check("code-reviewed", {
			id: "ITEM-1",
			description: "test",
			stage: "code",
			createdAt: now.toISOString(),
			validation: {
				schemaVersion: "1",
				outcome: "accepted",
				validatedAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + 60_000).toISOString(),
				summary: { passed: 1, failed: 0, warnings: 0 },
			},
		} as any);
		expect(result.allowed).toBe(true);
	});

	it("returns stable reason codes for missing, rejected and expired validation evidence", () => {
		const root = fixture();
		const checker = new GateChecker(root, makeManifest({
			"code-reviewed": { id: "code-reviewed", name: "Code reviewed", type: "automated", blocking: true, description: "test", check_type: "validation" },
		}));
		const base = { id: "ITEM-1", description: "test", stage: "code", createdAt: new Date().toISOString() } as any;
		expect(checker.check("code-reviewed", base)).toMatchObject({ allowed: false, reasonCode: "VALIDATION_EVIDENCE_MISSING" });
		expect(checker.check("code-reviewed", { ...base, validation: { schemaVersion: "1", outcome: "rejected", validatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), summary: { passed: 0, failed: 1, warnings: 0 } } })).toMatchObject({ allowed: false, reasonCode: "VALIDATION_REJECTED" });
		expect(checker.check("code-reviewed", { ...base, validation: { schemaVersion: "1", outcome: "accepted", validatedAt: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString(), summary: { passed: 1, failed: 0, warnings: 0 } } })).toMatchObject({ allowed: false, reasonCode: "VALIDATION_EVIDENCE_EXPIRED" });
	});
});
});
