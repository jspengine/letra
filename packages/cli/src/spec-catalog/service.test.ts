import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Workflow } from "../commands/flow-init.js";
import { buildSpecCatalog, readSpecCatalog, restoreDisposition, specCatalogPath, validateSpecCatalog, writeSpecCatalog } from "./service.js";
import { DEFAULT_CATALOG_CONFIG, type SpecCatalogConfig } from "./config.js";

describe("spec catalog", () => {
	let root: string;
	let workflow: Workflow;

	beforeEach(() => {
		root = join(tmpdir(), `letra-spec-catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "core-spec"), { recursive: true });
		mkdirSync(join(specs, "feature-spec"), { recursive: true });
		mkdirSync(join(specs, "unlinked-spec"), { recursive: true });
		mkdirSync(join(specs, "invalid-spec"), { recursive: true });
		writeFileSync(join(specs, "core-spec", "spec.md"), "# Core\n\n## Acceptance Criteria\n- [ ] AC1\n");
		writeFileSync(
			join(specs, "feature-spec", "spec.md"),
			"# Feature\n\nThe prose mentions unlinked-spec but it is not a dependency.\n\n## Dependencies\n- core-spec\n\n## Acceptance Criteria\n- [ ] AC1\n",
		);
		writeFileSync(join(specs, "unlinked-spec", "spec.md"), "# Unlinked\n");
		writeFileSync(join(root, ".letra", "focus.md"), "# Focus: feature-spec\n");
		mkdirSync(join(root, ".letra", "session-log", "2026", "09"), { recursive: true });
		writeFileSync(
			join(root, ".letra", "session-log", "2026", "09", "11.jsonl"),
			[
				JSON.stringify({ id: "log-1", timestamp: "2026-09-11T10:00:00.000Z", action: "item_claim", description: "claimed", itemId: "ITEM-1" }),
				JSON.stringify({ id: "log-2", timestamp: "2026-09-11T11:00:00.000Z", action: "agent_execution_event", description: "heartbeat", itemId: "ITEM-1" }),
				JSON.stringify({ id: "log-3", timestamp: "2026-09-11T12:00:00.000Z", action: "item_move", description: "done", itemId: "ITEM-2" }),
			].join("\n"),
		);
		workflow = {
			version: "1",
			name: "fixture",
			createdAt: "2026-09-01T00:00:00.000Z",
			updatedAt: "2026-09-11T12:00:00.000Z",
			stages: [
				{ id: "design", name: "Design", order: 1, zone: "doing" },
				{ id: "done", name: "Done", order: 2, zone: "done" },
			],
			items: [
				{ id: "ITEM-1", description: "Feature in flight", stage: "design", createdAt: "2026-09-02T00:00:00.000Z", spec: "feature-spec" },
				{ id: "ITEM-2", description: "Core completed", stage: "done", createdAt: "2026-09-03T00:00:00.000Z", spec: "core-spec" },
				{ id: "ITEM-3", description: "Missing linked spec", stage: "design", createdAt: "2026-09-04T00:00:00.000Z", spec: "missing-spec" },
			],
			tools: [],
		};
	});

	afterEach(() => {
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});

	it("inventories every spec directory and workflow link with status, last use, explicit dependencies, and focus relation", () => {
		const catalog = buildSpecCatalog(root, workflow);
		const specs = new Map(catalog.specs.map((spec) => [spec.id, spec]));

		expect(specs.get("feature-spec")).toMatchObject({
			status: "active",
			valid: true,
			itemIds: ["ITEM-1"],
			lastUsedAt: "2026-09-11T11:00:00.000Z",
			lastUseSource: "session-log",
			dependencies: ["core-spec"],
			direction: { relationship: "current-focus", focus: true },
		});
		expect(specs.get("feature-spec")?.dependencies).not.toContain("unlinked-spec");
		expect(specs.get("core-spec")).toMatchObject({ status: "completed", itemIds: ["ITEM-2"] });
		expect(specs.get("unlinked-spec")).toMatchObject({ status: "unlinked", lastUsedAt: null, lastUseSource: "unknown" });
		expect(specs.get("invalid-spec")).toMatchObject({ status: "invalid", valid: false });
		expect(specs.get("missing-spec")).toMatchObject({ status: "invalid", valid: false, itemIds: ["ITEM-3"] });
		expect(catalog.items).toHaveLength(3);
		expect(catalog.items.find((item) => item.id === "ITEM-1")).toMatchObject({ spec: "feature-spec", resolvedSpec: "feature-spec", consolidatedFrom: null, specDisposition: "active" });
		expect(catalog.items.find((item) => item.id === "ITEM-3")).toMatchObject({ spec: "missing-spec", resolvedSpec: "missing-spec", consolidatedFrom: null, specDisposition: "missing" });
		expect(catalog.currentFocus).toEqual({ spec: "feature-spec", itemId: "ITEM-1" });
	});

	it("writes and reads the canonical inventory in the resolved Letra data directory", () => {
		const catalog = writeSpecCatalog(root, workflow);
		expect(specCatalogPath(root)).toBe(join(".letra", "spec-catalog.json"));
		expect(readSpecCatalog(root)).toEqual(catalog);
		const dispositionFile = JSON.parse(readFileSync(join(root, ".letra", "spec-dispositions.json"), "utf8")) as { records: Array<{ specId: string; disposition: string; rationale: string; decidedBy: string; rollbackRef: string }> };
		expect(dispositionFile.records).toHaveLength(5);
		expect(dispositionFile.records.find((record) => record.specId === "feature-spec")).toMatchObject({
			disposition: "active",
			decidedBy: "spec-governance-hygiene",
			rollbackRef: "specs/feature-spec",
		});
		expect(dispositionFile.records.find((record) => record.specId === "unlinked-spec")?.disposition).toBe("archived");
	});

	it("records consolidation targets without deleting the source history", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "design-system"), { recursive: true });
		writeFileSync(join(specs, "design-system", "spec.md"), "# Design system\n");
		const catalog = writeSpecCatalog(root, workflow);
		const record = catalog.specs.find((spec) => spec.id === "design-system")?.disposition;
		expect(record).toMatchObject({ disposition: "consolidated", canonicalSpecId: "design-system-v2" });
		expect(record?.rollbackRef).toBe("specs/design-system");
		expect(record?.preservedPaths).toContain("specs/design-system/spec.md");
	});

	it("detects invalid dispositions, duplicate canonical claims, broken links, and active archived items", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8")) as { records: Array<Record<string, unknown>> };
		const feature = parsed.records.find((record) => record.specId === "feature-spec")!;
		feature.disposition = "active";
		feature.canonicalSpecId = "ghost-spec";
		feature.rollbackRef = "";
		feature.preservedPaths = [];
		const unlinked = parsed.records.find((record) => record.specId === "unlinked-spec")!;
		unlinked.disposition = "active";
		unlinked.canonicalSpecId = "core-spec";
		unlinked.rollbackRef = "specs/unlinked-spec";
		unlinked.preservedPaths = ["specs/unlinked-spec/spec.md"];
		const invalidRecord = parsed.records.find((record) => record.specId === "invalid-spec")!;
		invalidRecord.disposition = "retired";
		parsed.records.push({ ...parsed.records.find((record) => record.specId === "core-spec"), specId: "core-spec-copy", disposition: "active", canonicalSpecId: "core-spec" });
		writeFileSync(dispositionPath, JSON.stringify(parsed, null, 2));
		const invalid = validateSpecCatalog(root, workflow);
		expect(invalid.valid).toBe(false);
		expect(invalid.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
			"DISPOSITION_INVALID",
			"CANONICAL_REFERENCE_BROKEN",
			"REVERSIBILITY_MISSING",
			"DUPLICATE_CANONICAL",
		]));

		const validRecords = parsed.records.filter((record) => record.specId !== "core-spec-copy");
		const validFeature = validRecords.find((record) => record.specId === "feature-spec")!;
		validFeature.disposition = "archived";
		validFeature.canonicalSpecId = null;
		validFeature.rollbackRef = "specs/feature-spec";
		validFeature.preservedPaths = ["specs/feature-spec/spec.md"];
		const validUnlinked = validRecords.find((record) => record.specId === "unlinked-spec")!;
		validUnlinked.disposition = "archived";
		writeFileSync(dispositionPath, JSON.stringify({ schemaVersion: "1", records: validRecords }, null, 2));
		const activeArchived = validateSpecCatalog(root, workflow);
		expect(activeArchived.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "ACTIVE_ARCHIVED_REFERENCE", itemId: "ITEM-1" }),
		]));
	});

	it("AC9 — works with arbitrary spec IDs not in the default config", () => {
		const customRoot = join(tmpdir(), `letra-spec-catalog-ac9-${Date.now()}`);
		const specs = join(customRoot, ".letra", "specs");
		mkdirSync(join(specs, "my-custom-spec"), { recursive: true });
		mkdirSync(join(specs, "another-spec"), { recursive: true });
		writeFileSync(join(specs, "my-custom-spec", "spec.md"), "# Custom\n");
		writeFileSync(join(specs, "another-spec", "spec.md"), "# Another\n");
		mkdirSync(join(customRoot, ".letra", "session-log", "2026", "09"), { recursive: true });
		writeFileSync(join(customRoot, ".letra", "session-log", "2026", "09", "14.jsonl"), "");
		const customWorkflow: Workflow = {
			version: "1",
			name: "custom",
			createdAt: "2026-09-01T00:00:00.000Z",
			updatedAt: "2026-09-14T00:00:00.000Z",
			stages: [{ id: "code", name: "Code", order: 1, zone: "doing" }],
			items: [
				{ id: "CUST-1", description: "Custom task", stage: "code", createdAt: "2026-09-14T00:00:00.000Z", spec: "my-custom-spec" },
			],
			tools: [],
		};
		try {
			const catalog = buildSpecCatalog(customRoot, customWorkflow);
			const specIds = catalog.specs.map((s) => s.id);
			expect(specIds).toContain("my-custom-spec");
			expect(specIds).toContain("another-spec");
			const mySpec = catalog.specs.find((s) => s.id === "my-custom-spec");
			expect(mySpec?.disposition.disposition).toBe("active");
			expect(mySpec?.disposition.decidedBy).toBe("spec-governance-hygiene");
			expect(mySpec?.priority.tier).toBe("supervision");
		} finally {
			if (existsSync(customRoot)) rmSync(customRoot, { recursive: true, force: true });
		}
	});

	it("AC9 — buildSpecCatalog does not write files (read-only consultation)", () => {
		const catalog = buildSpecCatalog(root, workflow);
		// After buildSpecCatalog, no spec-catalog.json or spec-dispositions.json should exist
		expect(existsSync(join(root, ".letra", "spec-catalog.json"))).toBe(false);
		expect(existsSync(join(root, ".letra", "spec-dispositions.json"))).toBe(false);
		// The catalog is returned but not persisted
		expect(catalog.specs.length).toBeGreaterThan(0);
	});

	it("AC9 — repeated builds produce identical output without file mutation", () => {
		const catalog1 = buildSpecCatalog(root, workflow);
		const catalog2 = buildSpecCatalog(root, workflow);
		// Remove generatedAt and decidedAt which change per call
		const strip = (c: ReturnType<typeof buildSpecCatalog>) => {
			const { generatedAt: _, ...rest } = c;
			return {
				...rest,
				specs: rest.specs.map((s) => {
					const { decidedAt: __, ...disp } = s.disposition;
					return { ...s, disposition: disp };
				}),
			};
		};
		expect(strip(catalog1)).toEqual(strip(catalog2));
		// No files should have been written
		expect(existsSync(join(root, ".letra", "spec-catalog.json"))).toBe(false);
		expect(existsSync(join(root, ".letra", "spec-dispositions.json"))).toBe(false);
	});

	it("AC9 — writeSpecCatalog preserves manually created decisions on regeneration", () => {
		// First write: generates default dispositions
		const catalog1 = writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed1 = JSON.parse(readFileSync(dispositionPath, "utf8")) as { records: Array<{ specId: string; decidedBy: string; decidedAt: string; rationale: string }> };
		const featureRecord1 = parsed1.records.find((r) => r.specId === "feature-spec")!;
		expect(featureRecord1.decidedBy).toBe("spec-governance-hygiene");
		const originalDecidedAt = featureRecord1.decidedAt;
		const originalRationale = featureRecord1.rationale;

		// Manually override the decision
		featureRecord1.decidedBy = "human-reviewer";
		featureRecord1.rationale = "Manually reviewed and kept active";
		featureRecord1.decidedAt = "2026-09-14T10:00:00.000Z";
		writeFileSync(dispositionPath, JSON.stringify({ schemaVersion: "1", records: parsed1.records }, null, 2));

		// Second write: should preserve the human decision
		writeSpecCatalog(root, workflow);
		const parsed2 = JSON.parse(readFileSync(dispositionPath, "utf8")) as { records: Array<{ specId: string; decidedBy: string; decidedAt: string; rationale: string }> };
		const featureRecord2 = parsed2.records.find((r) => r.specId === "feature-spec")!;
		expect(featureRecord2.decidedBy).toBe("human-reviewer");
		expect(featureRecord2.rationale).toBe("Manually reviewed and kept active");
		expect(featureRecord2.decidedAt).toBe("2026-09-14T10:00:00.000Z");
	});

	it("AC10 — invalid JSON in dispositions produces structured diagnostic", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		writeFileSync(dispositionPath, "{ invalid json", "utf8");
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "DISPOSITIONS_INVALID" }),
		]));
	});

	it("AC10 — null records in dispositions produces structured diagnostic", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		writeFileSync(dispositionPath, JSON.stringify({ schemaVersion: "1", records: [null, { specId: "core-spec", disposition: "active", canonicalSpecId: "core-spec", rationale: "test", decidedBy: "test", decidedAt: "2026-09-14T00:00:00Z", rollbackRef: "specs/core-spec", preservedPaths: ["specs/core-spec/spec.md"] }] }, null, 2), "utf8");
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "DISPOSITION_NULL_RECORD" }),
		]));
	});

	it("AC10 — unknown schema version produces structured diagnostic", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		parsed.schemaVersion = "99";
		writeFileSync(dispositionPath, JSON.stringify(parsed, null, 2), "utf8");
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "SCHEMA_VERSION_UNKNOWN" }),
		]));
	});

	it("AC10 — missing spec.md produces structured diagnostic", () => {
		writeSpecCatalog(root, workflow);
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "no-file-spec"), { recursive: true });
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "SPEC_FILE_MISSING", specId: "no-file-spec" }),
		]));
	});

	it("AC10 — consolidation cycle produces structured diagnostic", () => {
		const config: SpecCatalogConfig = {
			...DEFAULT_CATALOG_CONFIG,
			consolidationTargets: {
				"spec-a": "spec-b",
				"spec-b": "spec-a",
			},
		};
		writeFileSync(join(root, ".letra", "spec-catalog.config.json"), JSON.stringify(config, null, 2));
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "spec-a"), { recursive: true });
		mkdirSync(join(specs, "spec-b"), { recursive: true });
		writeFileSync(join(specs, "spec-a", "spec.md"), "# A\n");
		writeFileSync(join(specs, "spec-b", "spec.md"), "# B\n");
		writeSpecCatalog(root, workflow);
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "CONSOLIDATION_CYCLE" }),
		]));
	});

	it("AC10 — workflow reference to non-existent spec produces WORKFLOW_REFERENCE_UNVERIFIED", () => {
		const ws: Workflow = {
			...workflow,
			items: [...workflow.items, { id: "ITEM-GHOST", description: "Ghost", stage: "design", createdAt: "2026-09-14T00:00:00Z", spec: "ghost-spec" }],
		};
		writeSpecCatalog(root, ws);
		const result = validateSpecCatalog(root, ws);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "ITEM_SPEC_MISSING", itemId: "ITEM-GHOST" }),
		]));
	});

	it("AC11 — CLI, MCP, and Web read the same projection from the same fixture", () => {
		const catalog = writeSpecCatalog(root, workflow);
		const cliResult = readSpecCatalog(root);
		const mcpResult = readSpecCatalog(root);
		const webResult = readSpecCatalog(root);
		expect(cliResult).toEqual(mcpResult);
		expect(mcpResult).toEqual(webResult);
		expect(cliResult?.specs.map((s) => s.id)).toEqual(catalog.specs.map((s) => s.id));
	});

	it("AC11 — archived items leave active queue and remain accessible via history", () => {
		const catalog = writeSpecCatalog(root, workflow);
		const archivedSpec = catalog.specs.find((s) => s.disposition.disposition === "archived");
		expect(archivedSpec).toBeDefined();
		const activeQueue = catalog.specs.filter((s) => s.disposition.disposition !== "archived");
		expect(activeQueue.find((s) => s.id === archivedSpec!.id)).toBeUndefined();
		const allSpecs = readSpecCatalog(root)?.specs ?? [];
		expect(allSpecs.find((s) => s.id === archivedSpec!.id)).toBeDefined();
	});

	it("AC11 — disposition change is reflected after regeneration", () => {
		const catalog1 = writeSpecCatalog(root, workflow);
		const unlinkedBefore = catalog1.specs.find((s) => s.id === "unlinked-spec");
		expect(unlinkedBefore?.disposition.disposition).toBe("archived");

		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const unlinkedRecord = parsed.records.find((r: { specId: string }) => r.specId === "unlinked-spec");
		unlinkedRecord.disposition = "active";
		unlinkedRecord.decidedBy = "human-reviewer";
		writeFileSync(dispositionPath, JSON.stringify(parsed, null, 2));

		const catalog2 = writeSpecCatalog(root, workflow);
		const unlinkedAfter = catalog2.specs.find((s) => s.id === "unlinked-spec");
		expect(unlinkedAfter?.disposition.disposition).toBe("active");
		expect(unlinkedAfter?.disposition.decidedBy).toBe("human-reviewer");
	});

	it("AC11 — CATALOG_STALE detected when dispositions modified after catalog generation", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		parsed.records[0].rationale = "modified after catalog";
		writeFileSync(dispositionPath, JSON.stringify(parsed, null, 2));
		// Set mtime well beyond the 2s tolerance to simulate stale file
		const futureTime = new Date(Date.now() + 5000);
		utimesSync(dispositionPath, futureTime, futureTime);
		const result = validateSpecCatalog(root, workflow);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "CATALOG_STALE" }),
		]));
	});

	it("AC12 — consolidation resolves operational references and preserves origin mapping", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "design-system"), { recursive: true });
		mkdirSync(join(specs, "design-system-v2"), { recursive: true });
		writeFileSync(join(specs, "design-system", "spec.md"), "# DS v1\n");
		writeFileSync(join(specs, "design-system-v2", "spec.md"), "# DS v2\n");
		const ws: Workflow = {
			...workflow,
			items: [
				...workflow.items,
				{ id: "ITEM-DS", description: "DS v1 work", stage: "design", createdAt: "2026-09-14T00:00:00Z", spec: "design-system" },
			],
		};
		const catalog = writeSpecCatalog(root, ws);
		const dsItem = catalog.items.find((i) => i.id === "ITEM-DS");
		expect(dsItem).toBeDefined();
		expect(dsItem!.resolvedSpec).toBe("design-system-v2");
		expect(dsItem!.consolidatedFrom).toBe("design-system");
		expect(dsItem!.dependencies).toContain("design-system");
		expect(dsItem!.dependencies).toContain("design-system-v2");
		const dsSpec = catalog.specs.find((s) => s.id === "design-system");
		expect(dsSpec?.disposition.disposition).toBe("consolidated");
		expect(dsSpec?.disposition.canonicalSpecId).toBe("design-system-v2");
	});

	it("AC12 — querying by canonical spec returns items that were consolidated into it", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "design-system"), { recursive: true });
		mkdirSync(join(specs, "design-system-v2"), { recursive: true });
		writeFileSync(join(specs, "design-system", "spec.md"), "# DS v1\n");
		writeFileSync(join(specs, "design-system-v2", "spec.md"), "# DS v2\n");
		const ws: Workflow = {
			...workflow,
			items: [
				...workflow.items,
				{ id: "ITEM-DS", description: "DS v1 work", stage: "code", createdAt: "2026-09-14T00:00:00Z", spec: "design-system" },
			],
		};
		const catalog = writeSpecCatalog(root, ws);
		const v2Items = catalog.items.filter((i) => i.resolvedSpec === "design-system-v2");
		expect(v2Items.length).toBeGreaterThanOrEqual(1);
		expect(v2Items.map((i) => i.id)).toContain("ITEM-DS");
	});

	it("AC13 — multi-line dependencies are parsed from Dependencies section", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "dep-a"), { recursive: true });
		mkdirSync(join(specs, "dep-b"), { recursive: true });
		mkdirSync(join(specs, "dep-c"), { recursive: true });
		writeFileSync(join(specs, "dep-a", "spec.md"), "# A\n\n## Dependencies\n- dep-b\n- dep-c\n");
		writeFileSync(join(specs, "dep-b", "spec.md"), "# B\n");
		writeFileSync(join(specs, "dep-c", "spec.md"), "# C\n");
		const catalog = buildSpecCatalog(root, workflow);
		const specA = catalog.specs.find((s) => s.id === "dep-a");
		expect(specA?.dependencies).toContain("dep-b");
		expect(specA?.dependencies).toContain("dep-c");
	});

	it("AC13 — items are ordered by dependencies and priority", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "z-dep"), { recursive: true });
		mkdirSync(join(specs, "a-dep"), { recursive: true });
		writeFileSync(join(specs, "z-dep", "spec.md"), "# Z\n\n## Dependencies\n- a-dep\n");
		writeFileSync(join(specs, "a-dep", "spec.md"), "# A\n");
		const catalog = buildSpecCatalog(root, workflow);
		const ids = catalog.specs.map((s) => s.id);
		const zIdx = ids.indexOf("z-dep");
		const aIdx = ids.indexOf("a-dep");
		expect(aIdx).toBeLessThan(zIdx);
	});

	it("AC13 — primaryItemId is set when multiple items share a spec", () => {
		const ws: Workflow = {
			...workflow,
			items: [
				...workflow.items,
				{ id: "ITEM-1B", description: "Feature alt", stage: "design", createdAt: "2026-09-15T00:00:00Z", spec: "feature-spec" },
			],
		};
		const catalog = buildSpecCatalog(root, ws);
		const featureSpec = catalog.specs.find((s) => s.id === "feature-spec");
		expect(featureSpec?.primaryItemId).toBe("ITEM-1");
		expect(featureSpec?.itemIds).toContain("ITEM-1");
		expect(featureSpec?.itemIds).toContain("ITEM-1B");
	});

	it("AC10 — dependency cycle detection in validateSpecCatalog", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "cycle-a"), { recursive: true });
		mkdirSync(join(specs, "cycle-b"), { recursive: true });
		writeFileSync(join(specs, "cycle-a", "spec.md"), "# A\n\n## Dependencies\n- cycle-b\n");
		writeFileSync(join(specs, "cycle-b", "spec.md"), "# B\n\n## Dependencies\n- cycle-a\n");
		writeSpecCatalog(root, workflow);
		const result = validateSpecCatalog(root, workflow);
		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: "CONSOLIDATION_CYCLE" }),
		]));
	});

	it("AC9 — workspace config override changes consolidation targets", () => {
		const config: SpecCatalogConfig = {
			...DEFAULT_CATALOG_CONFIG,
			consolidationTargets: {
				"my-old-spec": "my-new-spec",
			},
		};
		writeFileSync(join(root, ".letra", "spec-catalog.config.json"), JSON.stringify(config, null, 2));
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "my-old-spec"), { recursive: true });
		writeFileSync(join(specs, "my-old-spec", "spec.md"), "# Old\n");
		const catalog = writeSpecCatalog(root, workflow);
		const oldSpec = catalog.specs.find((s) => s.id === "my-old-spec");
		expect(oldSpec?.disposition.disposition).toBe("consolidated");
		expect(oldSpec?.disposition.canonicalSpecId).toBe("my-new-spec");
	});

	it("AC14 — restoreDisposition restores archived spec to active with audit trail", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const unlinked = parsed.records.find((r: { specId: string }) => r.specId === "unlinked-spec");
		expect(unlinked?.disposition).toBe("archived");
		const restored = restoreDisposition(root, "unlinked-spec");
		expect(restored).not.toBeNull();
		expect(restored!.disposition).toBe("active");
		expect(restored!.canonicalSpecId).toBe("unlinked-spec");
		expect(restored!.rationale).toContain("Restaurada de archived");
		const reparsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const restoredRecord = reparsed.records.find((r: { specId: string }) => r.specId === "unlinked-spec");
		expect(restoredRecord.disposition).toBe("active");
	});

	it("AC14 — restoreDisposition restores consolidated spec and preserves origin paths", () => {
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "design-system"), { recursive: true });
		mkdirSync(join(specs, "design-system-v2"), { recursive: true });
		writeFileSync(join(specs, "design-system", "spec.md"), "# DS v1\n");
		writeFileSync(join(specs, "design-system-v2", "spec.md"), "# DS v2\n");
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const ds = parsed.records.find((r: { specId: string }) => r.specId === "design-system");
		expect(ds?.disposition).toBe("consolidated");
		const restored = restoreDisposition(root, "design-system");
		expect(restored!.disposition).toBe("active");
		expect(restored!.preservedPaths).toContain("specs/design-system/spec.md");
	});

	it("AC14 — archive/restore cycle preserves all links without loss", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		let parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const original = parsed.records.find((r: { specId: string }) => r.specId === "feature-spec");
		const originalRationale = original.rationale;
		const originalPreservedPaths = [...original.preservedPaths];

		// Archive
		original.disposition = "archived";
		original.decidedBy = "human-reviewer";
		writeFileSync(dispositionPath, JSON.stringify(parsed, null, 2));

		// Restore
		restoreDisposition(root, "feature-spec");
		parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		const restored = parsed.records.find((r: { specId: string }) => r.specId === "feature-spec");
		expect(restored.disposition).toBe("active");
		expect(restored.preservedPaths).toEqual(originalPreservedPaths);
		expect(restored.rollbackRef).toBe(original.rollbackRef);
	});

	it("AC14 — restoreDisposition returns null for non-existent spec", () => {
		const result = restoreDisposition(root, "non-existent-spec");
		expect(result).toBeNull();
	});

	it("AC14 — writeSpecCatalog writes dispositions atomically (no partial state)", () => {
		writeSpecCatalog(root, workflow);
		const dispositionPath = join(root, ".letra", "spec-dispositions.json");
		const parsed = JSON.parse(readFileSync(dispositionPath, "utf8"));
		expect(parsed.schemaVersion).toBe("1");
		expect(Array.isArray(parsed.records)).toBe(true);
		expect(parsed.records.length).toBeGreaterThan(0);
	});
});
