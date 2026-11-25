import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	changedWorkspaceFiles,
	captureSecurityBaseline,
	createSecurityContext,
	evaluateSecurityReview,
	parseSecurityAuditOutput,
	readDependencySnapshot,
	runScopedSecurityReview,
	securityReportFingerprint,
	type SecurityBaseline,
} from "./scoped-review.js";

const baseline: SecurityBaseline = {
	version: "1",
	capturedAt: "2026-09-11T00:00:00.000Z",
	gitRevision: "abc123",
	packageLockSha256: "lock-before",
	files: { "src/changed.ts": "before" },
	dependencies: { "safe-package": "1.0.0" },
};

function context(overrides: Partial<Parameters<typeof createSecurityContext>[0]> = {}) {
	return createSecurityContext({
		itemId: "ITEM-93",
		specId: "security-review-scoped",
		acceptanceCriteria: ["AC1", "AC9"],
		changedFiles: ["src/changed.ts"],
		changedDependencies: ["changed-package"],
		baseline,
		dependencyPaths: { "changed-package": ["changed-package"] },
		...overrides,
	});
}

describe("scoped security review", () => {
	it("blocks an introduced, related and reachable high finding", () => {
		const report = evaluateSecurityReview(context(), [{
			id: "npm:changed-package",
			severity: "high",
			package: "changed-package",
			source: "dependency",
			evidence: ["npm audit changed-package"],
		}]);

		expect(report.decision).toBe("blocked");
		expect(report.reasonCode).toBe("SECURITY_SCOPED_BLOCKED");
		expect(report.blockingFindings).toHaveLength(1);
	});

	it("keeps a preexisting global finding visible without blocking", () => {
		const report = evaluateSecurityReview(context(), [{
			id: "npm:historical-package",
			severity: "high",
			package: "historical-package",
			source: "dependency",
			evidence: ["baseline audit"],
		}]);

		expect(report.decision).toBe("clear");
		expect(report.blockingFindings).toHaveLength(0);
		expect(report.globalFindings).toHaveLength(1);
		expect(report.globalFindings[0]?.introduced).toBe(false);
	});

	it("does not block an unreachable dependency finding", () => {
		const report = evaluateSecurityReview(context(), [{
			id: "npm:changed-package",
			severity: "critical",
			package: "changed-package",
			source: "dependency",
			reachable: false,
			evidence: ["optional dependency not reachable by affected path"],
		}]);

		expect(report.decision).toBe("clear");
		expect(report.globalFindings[0]?.reachable).toBe(false);
	});

	it("preserves scope and baseline immutability in report output", () => {
		const source = context();
		const report = evaluateSecurityReview(source, []);

		expect(report.context.itemId).toBe("ITEM-93");
		expect(report.context.specId).toBe("security-review-scoped");
		expect(report.context.baseline.packageLockSha256).toBe("lock-before");
		expect(report.context.changedFiles).toEqual(["src/changed.ts"]);
	});

	it("reports baseline files that disappeared from the current workspace", () => {
		const snapshot = { ...baseline, files: { "src/changed.ts": "before", "src/removed.ts": "old" } };
		expect(changedWorkspaceFiles("C:/path-that-is-not-a-repository", snapshot)).toEqual(["src/changed.ts", "src/removed.ts"]);
	});

	it("preserves npm audit advisories and classifies only changed packages as scoped", () => {
		const audit = parseSecurityAuditOutput(JSON.stringify({ vulnerabilities: {
			"changed-package": { severity: "high", via: [{ title: "Changed advisory", url: "https://example.test/advisory" }], nodes: ["node_modules/changed-package"] },
			"historical-package": { severity: "high", via: ["historical-advisory"], nodes: ["node_modules/historical-package"] },
		} }), context());
		expect(audit).toHaveLength(2);
		expect(audit[0]).toMatchObject({ package: "changed-package", advisory: "https://example.test/advisory", introduced: true, relatedToSpec: true, reachable: true });
		expect(audit[1]).toMatchObject({ package: "historical-package", introduced: false, relatedToSpec: false, reachable: "unknown" });
	});

	it("does not clear the gate when a scanner cannot produce JSON", () => {
		const report = evaluateSecurityReview(context(), [], { blockOnCritical: true, blockOnHigh: true }, undefined, ["npm audit failed"]);
		expect(report.decision).toBe("needs-review");
		expect(report.reasonCode).toBe("SECURITY_SCAN_FAILED");
		expect(report.scanErrors).toEqual(["npm audit failed"]);
	});

	it("requires a causal import path before a changed dependency is reachable", () => {
		const report = evaluateSecurityReview(context({ dependencyPaths: {} }), [{
			package: "changed-package",
			severity: "critical",
			source: "dependency",
			evidence: ["version changed without an affected import path"],
		}]);
		expect(report.blockingFindings).toHaveLength(0);
		expect(report.findings[0]?.reachable).toBe("unknown");
		expect(report.decision).toBe("needs-review");
	});

	it("captures a complete baseline fingerprint for the pre-Code snapshot", () => {
		const snapshot = captureSecurityBaseline("C:/workspace-without-git", { files: { "src/a.ts": "before" }, dependencies: { a: "1.0.0" } });
		expect(snapshot.fileSnapshotComplete).toBe(true);
		expect(snapshot.dependencySnapshotComplete).toBe(true);
		expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
	});

	it.each([
		["package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/app": { version: "1.0.0", dependencies: { dep: "^1" } }, "node_modules/dep": { version: "1.2.0" } } }), "npm"],
		["npm-shrinkwrap.json", JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/app": { version: "1.0.0", dependencies: { dep: "^1" } }, "node_modules/dep": { version: "1.2.0" } } }), "npm"],
		["yarn.lock", '"app@^1.0.0":\n  version "1.0.0"\n  dependencies:\n    dep "^1.0.0"\n\n"dep@^1.0.0":\n  version "1.2.0"\n', "yarn"],
		["pnpm-lock.yaml", "lockfileVersion: '9.0'\npackages:\n  app@1.0.0:\n    version: 1.0.0\n    dependencies:\n      dep: 1.2.0\n  dep@1.2.0:\n    version: 1.2.0\n", "pnpm"],
	] as const)("parses supported dependency manager lockfile %s", (filename, contents, expectedManager = filename === "yarn.lock" ? "yarn" : "pnpm") => {
		const root = mkdtempSync(join(tmpdir(), "letra-lockfile-"));
		writeFileSync(join(root, filename), contents, "utf8");
		const snapshot = readDependencySnapshot(root);
		expect(snapshot.complete).toBe(true);
		expect(snapshot.manager).toBe(expectedManager);
		expect(snapshot.map).toMatchObject({ app: "1.0.0", dep: "1.2.0" });
		expect(snapshot.graph.app).toContain("dep");
	});

	it("marks unsupported or absent dependency snapshots incomplete", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-lockfile-missing-"));
		const snapshot = readDependencySnapshot(root);
		expect(snapshot.complete).toBe(false);
		expect(captureSecurityBaseline(root).dependencySnapshotComplete).toBe(false);
	});

	it("fails closed when Git cannot enumerate the baseline", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-git-missing-"));
		const snapshot = captureSecurityBaseline(root);
		expect(snapshot.fileSnapshotComplete).toBe(false);
		expect(snapshot.files).toEqual({});
	});

	it("fails closed when Git disappears after a valid baseline", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-git-lost-after-baseline-"));
		const snapshot = captureSecurityBaseline(root, {
			files: { "src/changed.ts": "before" },
			dependencies: { "changed-package": "1.0.0" },
			gitRevision: "abc123",
		});
		const report = runScopedSecurityReview(root, {
			id: "ITEM-93",
			description: "",
			stage: "security",
			createdAt: "",
			spec: "security-review-scoped",
			securityBaseline: snapshot,
		} as never, { blockOnCritical: true, blockOnHigh: true });
		expect(report.scanErrors?.some((error) => error.includes("Git não conseguiu enumerar"))).toBe(true);
		expect(report.reasonCode).toBe("SECURITY_SCAN_FAILED");
		expect(report.scannerEvidence).toEqual(expect.arrayContaining([
			expect.objectContaining({ name: "git-workspace-enumeration", outcome: "failed", command: expect.stringContaining("git ls-files") }),
		]));
	});

	it("seals the report so changing the decision cannot clear Security", () => {
		const report = evaluateSecurityReview(context(), []);
		const tampered = { ...report, decision: "clear" as const, blockingFindings: [{ id: "forged" }] as never[] };
		expect(securityReportFingerprint(tampered)).not.toBe(report.reportFingerprint);
	});
});
