import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GateChecker } from "../harness/gate-checker.js";
import type { HarnessManifest } from "../harness/types.js";
import type { Item } from "../commands/flow-init.js";
import { evaluateSecurityReview, createSecurityContext, captureSecurityBaseline, securityScopeFingerprint, securityWorkspaceFingerprint } from "./scoped-review.js";

const root = mkdtempSync(join(tmpdir(), "letra-security-gate-"));
mkdirSync(join(root, "src"));
writeFileSync(join(root, "src", "changed.ts"), "import 'changed-package';\n", "utf8");
const beforeHash = createHash("sha256").update("before\n").digest("hex");
const baseline = captureSecurityBaseline(root, { files: { "src/changed.ts": beforeHash }, dependencies: { "changed-package": "1.0.0" }, gitRevision: "abc", packageLockSha256: "before" });

const manifest: HarnessManifest = {
	version: "v0.2.0",
	flows: {},
	roles: {},
	policies: {},
	executors: undefined,
	gates: {
		"security-clear": {
			id: "security-clear",
			name: "Security Clear",
			type: "automated",
			blocking: true,
			blocksHandoff: false,
			description: "Scoped security review",
			check_type: "security-scoped",
		},
	},
};

const baseContext = createSecurityContext({
	itemId: "ITEM-93",
	specId: "security-review-scoped",
	acceptanceCriteria: ["AC5"],
	changedFiles: ["src/changed.ts"],
	changedDependencies: ["changed-package"],
	baseline,
	workspaceFingerprint: securityWorkspaceFingerprint(root),
	scopeFingerprint: securityScopeFingerprint(root, baseline, ["src/changed.ts"], ["changed-package"]),
	dependencyPaths: { "changed-package": ["changed-package"] },
});
const scannerEvidence = [{ name: "test-scanner", command: "test scanner", version: "1", scope: ["src/changed.ts"], outcome: "completed" as const }];

function itemWithReport(report?: ReturnType<typeof evaluateSecurityReview>): Item {
	return { id: "ITEM-93", description: "", stage: "security", createdAt: "", spec: "security-review-scoped", securityBaseline: baseline, securityReview: report };
}

describe("security-clear scoped gate", () => {
	it("requires a report before allowing the gate", () => {
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport());
		expect(result.allowed).toBe(false);
		expect(result.reasonCode).toBe("SECURITY_REVIEW_REQUIRED");
	});

	it("blocks only a qualifying introduced finding", () => {
		const report = evaluateSecurityReview(baseContext, [{
			package: "changed-package",
			severity: "high",
			source: "dependency",
			evidence: ["audit"],
		}], undefined, undefined, [], scannerEvidence);
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport(report));
		expect(result.allowed).toBe(false);
		expect(result.reasonCode).toBe("SECURITY_SCOPED_BLOCKED");
	});

	it("allows preexisting findings while retaining them in the report", () => {
		const report = evaluateSecurityReview(baseContext, [{
			package: "historical-package",
			severity: "high",
			source: "dependency",
			evidence: ["baseline audit"],
		}], undefined, undefined, [], scannerEvidence);
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport(report));
		expect(result.allowed).toBe(true);
		expect(report.globalFindings).toHaveLength(1);
	});

	it("applies the scoped decision before a Security human approval", () => {
		const humanManifest: HarnessManifest = {
			...manifest,
			gates: {
				"human-approved": {
					id: "human-approved",
					name: "Human approval",
					type: "human",
					blocking: true,
					description: "Final approval",
					pre_check: "security-scoped",
				},
			},
		};
		const report = evaluateSecurityReview(baseContext, [{ package: "changed-package", severity: "high", source: "dependency", evidence: ["audit"] }], undefined, undefined, [], scannerEvidence);
		const result = new GateChecker(root, humanManifest).check("human-approved", { ...itemWithReport(report), stage: "security" });
		expect(result).toMatchObject({ allowed: false, reasonCode: "SECURITY_SCOPED_BLOCKED" });
	});

	it("invalidates a clear report when the reviewed scope changes", () => {
		const report = evaluateSecurityReview(baseContext, [], undefined, undefined, [], scannerEvidence);
		writeFileSync(join(root, "src", "changed.ts"), "import 'changed-package';\n// changed after review\n", "utf8");
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport(report));
		expect(result).toMatchObject({ allowed: false, reasonCode: "SECURITY_REVIEW_REQUIRED" });
	});

	it("blocks a report with incomplete scanner evidence", () => {
		writeFileSync(join(root, "src", "changed.ts"), "import 'changed-package';\n", "utf8");
		const report = evaluateSecurityReview(baseContext, [], undefined, undefined, [], [{ ...scannerEvidence[0], outcome: "failed" }]);
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport(report));
		expect(result).toMatchObject({ allowed: false, reasonCode: "SECURITY_SCAN_FAILED" });
	});

	it("uses the linked project as execution root while reading the canonical report", () => {
		const project = mkdtempSync(join(tmpdir(), "letra-linked-project-"));
		const canonical = mkdtempSync(join(tmpdir(), "letra-linked-data-"));
		mkdirSync(join(project, "src"), { recursive: true });
		writeFileSync(join(project, ".letra-link"), `${canonical}\n`, "utf8");
		writeFileSync(join(canonical, "workflow.json"), JSON.stringify({ items: [] }), "utf8");
		writeFileSync(join(project, "src", "changed.ts"), "import 'changed-package';\n", "utf8");
		const linkedBaseline = captureSecurityBaseline(project, { files: { "src/changed.ts": "before" }, dependencies: { "changed-package": "1.0.0" }, gitRevision: "abc", packageLockSha256: "before" });
		const linkedContext = createSecurityContext({
			itemId: "ITEM-93",
			specId: "security-review-scoped",
			acceptanceCriteria: ["AC18"],
			changedFiles: ["src/changed.ts"],
			changedDependencies: ["changed-package"],
			baseline: linkedBaseline,
			workspaceFingerprint: securityWorkspaceFingerprint(project),
			scopeFingerprint: securityScopeFingerprint(project, linkedBaseline, ["src/changed.ts"], ["changed-package"]),
			dependencyPaths: { "changed-package": ["changed-package"] },
		});
		const report = evaluateSecurityReview(linkedContext, [], undefined, undefined, [], scannerEvidence);
		const result = new GateChecker(project, manifest).check("security-clear", { id: "ITEM-93", description: "", stage: "security", createdAt: "", spec: "security-review-scoped", securityBaseline: linkedBaseline, securityReview: report });
		expect(result).toMatchObject({ allowed: true, reasonCode: "SECURITY_SCOPED_CLEAR" });
	});

	it("rejects a persisted report whose blocking findings were edited", () => {
		const report = evaluateSecurityReview(baseContext, [], undefined, undefined, [], scannerEvidence);
		const tampered = { ...report, blockingFindings: [{ id: "forged", severity: "high" }] as never[] };
		const result = new GateChecker(root, manifest).check("security-clear", itemWithReport(tampered));
		expect(result).toMatchObject({ allowed: false, reasonCode: "SECURITY_REVIEW_REQUIRED" });
	});
});
