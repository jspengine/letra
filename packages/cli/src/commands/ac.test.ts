import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markAcById, listPendingACs, findAcByPattern } from "./ac.js";
import { type Workflow, saveWorkflow } from "./flow-init.js";

function createTestDir(): string {
	const dir = join(tmpdir(), `letra-ac-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	mkdirSync(join(dir, ".letra", "specs", "test-spec"), { recursive: true });
	return dir;
}

function createWorkflow(): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "doing", name: "Doing", order: 1 },
			{ id: "done", name: "Done", order: 2 },
		],
		items: [{ id: "ITEM-1", description: "Test item", stage: "doing", spec: "test-spec", createdAt: "2026-01-01T00:00:00.000Z" }],
		tools: [],
		primaryItemId: "ITEM-1",
	};
}

const specContent = `# Test Spec

## Acceptance Criteria

- [ ] **AC1.1**: First criterion
- [ ] **AC1.2**: Second criterion
- [ ] **AC1.3**: Third criterion
- [x] **AC2.1**: Already done
`;

describe("ac command", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTestDir();
		vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe("findAcByPattern", () => {
		it("should find an AC by pattern", () => {
			const lines = specContent.split("\n");
			const idx = findAcByPattern(lines, "AC1.1");
			expect(idx).not.toBeNull();
			expect(lines[idx!].trim()).toContain("AC1.1");
		});

		it("should return null for non-existent AC", () => {
			const lines = specContent.split("\n");
			const idx = findAcByPattern(lines, "AC99.99");
			expect(idx).toBeNull();
		});

		it("should return null for already completed AC", () => {
			const lines = specContent.split("\n");
			const idx = findAcByPattern(lines, "AC2.1");
			expect(idx).toBeNull();
		});

		it("should find an AC regardless of line position", () => {
			const lines = specContent.split("\n");
			const idx = findAcByPattern(lines, "AC1.3");
			expect(idx).not.toBeNull();
		});
	});

	describe("listPendingACs", () => {
		it("should list all pending ACs", () => {
			const lines = specContent.split("\n");
			const pendings = listPendingACs(lines);
			expect(pendings).toHaveLength(3);
			expect(pendings.map((p) => p.id)).toEqual(["AC1.1", "AC1.2", "AC1.3"]);
		});

		it("should return empty for all-done spec", () => {
			const doneContent = specContent.replace(/- \[ \]/g, "- [x]");
			const lines = doneContent.split("\n");
			const pendings = listPendingACs(lines);
			expect(pendings).toHaveLength(0);
		});

		it("should return empty for spec without ACs", () => {
			const lines = ["# No criteria"];
			const pendings = listPendingACs(lines);
			expect(pendings).toHaveLength(0);
		});
	});

	describe("markAcById", () => {
		it("should mark an AC as done by ID", () => {
			const specFile = join(tmpDir, ".letra", "specs", "test-spec", "spec.md");
			writeFileSync(specFile, specContent, "utf-8");
			saveWorkflow(tmpDir, createWorkflow());

			markAcById(tmpDir, "AC1.1", "test-spec");

			const updated = readFileSync(specFile, "utf-8");
			expect(updated).toContain("- [x] **AC1.1**");
			expect(updated).toContain("- [ ] **AC1.2**");
		});

		it("should not modify other ACs", () => {
			const specFile = join(tmpDir, ".letra", "specs", "test-spec", "spec.md");
			writeFileSync(specFile, specContent, "utf-8");
			saveWorkflow(tmpDir, createWorkflow());

			markAcById(tmpDir, "AC1.2", "test-spec");

			const updated = readFileSync(specFile, "utf-8");
			expect(updated).toContain("- [ ] **AC1.1**");
			expect(updated).toContain("- [x] **AC1.2**");
			expect(updated).toContain("- [ ] **AC1.3**");
		});

		it("should reject non-existent AC ID", () => {
			const specFile = join(tmpDir, ".letra", "specs", "test-spec", "spec.md");
			writeFileSync(specFile, specContent, "utf-8");
			saveWorkflow(tmpDir, createWorkflow());

			expect(() => markAcById(tmpDir, "AC99.99", "test-spec")).toThrow();
		});

		it("should reject already-done AC", () => {
			const specFile = join(tmpDir, ".letra", "specs", "test-spec", "spec.md");
			writeFileSync(specFile, specContent, "utf-8");
			saveWorkflow(tmpDir, createWorkflow());

			expect(() => markAcById(tmpDir, "AC2.1", "test-spec")).toThrow();
		});

		it("should register ac_done entry in session-log (AC2.4)", () => {
			const specFile = join(tmpDir, ".letra", "specs", "test-spec", "spec.md");
			writeFileSync(specFile, specContent, "utf-8");
			saveWorkflow(tmpDir, createWorkflow());

			markAcById(tmpDir, "AC1.1", "test-spec");

			const sessionLogFile = join(tmpDir, ".letra", "session-log.json");
			expect(existsSync(sessionLogFile)).toBe(true);
			const log = JSON.parse(readFileSync(sessionLogFile, "utf-8"));
			const acDoneEntries = log.entries.filter((e: any) => e.action === "ac_done");
			expect(acDoneEntries.length).toBeGreaterThanOrEqual(1);
			expect(acDoneEntries[0].acId).toBe("AC1.1");
			expect(acDoneEntries[0].details?.spec).toBe("test-spec");
		});
	});
});
