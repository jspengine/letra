import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { logEntry } from "../session-log.js";
import { GateChecker } from "./gate-checker.js";

const roots: string[] = [];

function fixture(): string {
	const root = join(tmpdir(), `letra-gate-checker-${Date.now()}`);
	mkdirSync(root, { recursive: true });
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("GateChecker", () => {
	describe("checkHasSpecFile", () => {
		it("returns allowed when item has linked spec dir", () => {
			const root = fixture();
			mkdirSync(join(root, ".letra", "specs", "spec-1"), { recursive: true });

			const checker = new GateChecker(root);
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
			const checker = new GateChecker(root);
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
			const checker = new GateChecker(root);
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

			const checker = new GateChecker(root);
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

			const checker = new GateChecker(root);
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

			const checker = new GateChecker(root);
			const result = checker.check("all-acs-passing", item);
			expect(result.allowed).toBe(true);
		});

		it("returns blocked when spec file is missing", () => {
			const root = fixture();
			const checker = new GateChecker(root);
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

	describe("checkHumanApproved", () => {
		function writeGate(root: string, gateId: string, content: string) {
			mkdirSync(join(root, ".letra", "harness", "gates"), { recursive: true });
			writeFileSync(join(root, ".letra", "harness", "gates", `${gateId}.yaml`), content);
		}

		it("returns allowed when gate is approved", () => {
			const root = fixture();
			writeGate(
				root,
				"human-approved-code",
				"id: human-approved-code\nname: Code approval\ntype: human\nblocking: true\nstatus: approved\n",
			);

			const checker = new GateChecker(root);
			const result = checker.check("human-approved-code", {
				id: "ITEM-1",
				description: "test",
				stage: "review",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("returns blocked when gate is pending", () => {
			const root = fixture();
			writeGate(
				root,
				"human-approved-spec",
				"id: human-approved-spec\nname: Spec approval\ntype: human\nblocking: true\nstatus: pending\n",
			);

			const checker = new GateChecker(root);
			const result = checker.check("human-approved-spec", {
				id: "ITEM-1",
				description: "test",
				stage: "spec-review",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("pendente");
		});

		it("returns blocked when gate file is missing", () => {
			const root = fixture();
			const checker = new GateChecker(root);
			const result = checker.check("human-approved-code", {
				id: "ITEM-1",
				description: "test",
				stage: "review",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("não encontrado");
		});
	});

	describe("checkSecurityClear", () => {
		function writeGate(root: string, content: string) {
			mkdirSync(join(root, ".letra", "harness", "gates"), { recursive: true });
			writeFileSync(join(root, ".letra", "harness", "gates", "security-clear.yaml"), content);
		}

		it("returns allowed when gate is approved", () => {
			const root = fixture();
			writeGate(
				root,
				"id: security-clear\nname: Security\ntype: automated\nblocking: true\nstatus: approved\n",
			);

			const checker = new GateChecker(root);
			const result = checker.check("security-clear", {
				id: "ITEM-1",
				description: "test",
				stage: "security",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("returns blocked when gate is pending", () => {
			const root = fixture();
			writeGate(
				root,
				"id: security-clear\nname: Security\ntype: automated\nblocking: true\nstatus: pending\n",
			);

			const checker = new GateChecker(root);
			const result = checker.check("security-clear", {
				id: "ITEM-1",
				description: "test",
				stage: "security",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("pendente");
		});

		it("returns blocked when gate file is missing", () => {
			const root = fixture();
			const checker = new GateChecker(root);
			const result = checker.check("security-clear", {
				id: "ITEM-1",
				description: "test",
				stage: "security",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("não encontrado");
		});
	});

	describe("check", () => {
		it("falls back to allowed for unknown gate ids", () => {
			const root = fixture();
			const checker = new GateChecker(root);
			const result = checker.check("unknown-gate", {
				id: "ITEM-1",
				description: "test",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});
	});

	describe("checkBlocksHandoff", () => {
		function writeGate(root: string, gateId: string, content: string) {
			mkdirSync(join(root, ".letra", "harness", "gates"), { recursive: true });
			writeFileSync(join(root, ".letra", "harness", "gates", `${gateId}.yaml`), content);
		}

		it("returns true when gate has blocksHandoff: true", () => {
			const root = fixture();
			writeGate(
				root,
				"spec-approved",
				"id: spec-approved\nname: Spec Approved\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
			);

			const checker = new GateChecker(root);
			expect(checker.checkBlocksHandoff("spec-approved")).toBe(true);
		});

		it("returns false when gate has blocksHandoff: false", () => {
			const root = fixture();
			writeGate(
				root,
				"code-reviewed",
				"id: code-reviewed\nname: Code Reviewed\ntype: automated\nblocking: true\nblocksHandoff: false\nstatus: approved\n",
			);

			const checker = new GateChecker(root);
			expect(checker.checkBlocksHandoff("code-reviewed")).toBe(false);
		});

		it("returns false when gate does not exist", () => {
			const root = fixture();
			const checker = new GateChecker(root);
			expect(checker.checkBlocksHandoff("nonexistent")).toBe(false);
		});
	});

	describe("checkHandoffAllowed", () => {
		function writeGate(root: string, gateId: string, content: string) {
			mkdirSync(join(root, ".letra", "harness", "gates"), { recursive: true });
			writeFileSync(join(root, ".letra", "harness", "gates", `${gateId}.yaml`), content);
		}

		it("allows handoff when gate does not exist", () => {
			const root = fixture();
			const checker = new GateChecker(root);
			const result = checker.checkHandoffAllowed("nonexistent", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});

		it("allows handoff when gate has no gateId", () => {
			const root = fixture();
			const checker = new GateChecker(root);
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
			writeGate(
				root,
				"spec-approved",
				"id: spec-approved\nname: Spec Approved\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
			);

			const checker = new GateChecker(root);
			const result = checker.checkHandoffAllowed("spec-approved", {
				id: "ITEM-1",
				description: "test",
				stage: "design",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(false);
			expect(result.blocksHandoff).toBe(true);
			expect(result.reason).toContain("blocks handoff");
		});

		it("allows handoff when gate blocksHandoff but is approved", () => {
			const root = fixture();
			writeGate(
				root,
				"spec-approved",
				"id: spec-approved\nname: Spec Approved\ntype: human\nblocking: true\nblocksHandoff: true\nstatus: approved\n",
			);

			const checker = new GateChecker(root);
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
			writeGate(
				root,
				"code-reviewed",
				"id: code-reviewed\nname: Code Reviewed\ntype: automated\nblocking: true\nblocksHandoff: false\nstatus: pending\n",
			);

			const checker = new GateChecker(root);
			const result = checker.checkHandoffAllowed("code-reviewed", {
				id: "ITEM-1",
				description: "test",
				stage: "code",
				createdAt: new Date().toISOString(),
			} as any);

			expect(result.allowed).toBe(true);
		});
	});
});
