import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { pulse } from "./pulse.js";

function createTestDir(): string {
	const dir = join(tmpdir(), `letra-pulse-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	mkdirSync(join(dir, ".letra"), { recursive: true });
	return dir;
}

function writeWorkflow(dir: string, overrides?: Record<string, unknown>) {
	const wf = {
		version: "1",
		name: "test-project",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 },
			{ id: "design", name: "Design", order: 1 },
			{ id: "code", name: "Code", order: 2 },
			{ id: "review", name: "Review", order: 3 },
			{ id: "done", name: "Done", order: 4 },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Feature X",
				stage: "code",
				createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
				spec: "feature-x",
			},
			{
				id: "ITEM-2",
				description: "Bug fix Y",
				stage: "backlog",
				createdAt: new Date().toISOString(),
			},
		],
		tools: ["cursor"],
		...overrides,
	};
	writeFileSync(join(dir, ".letra", "workflow.json"), JSON.stringify(wf, null, 2));
	return wf;
}

function writeSpec(dir: string, name: string, acs: string[]) {
	const specDir = join(dir, ".letra", "specs", name);
	mkdirSync(specDir, { recursive: true });
	const content = [
		"# Test Spec",
		"",
		"## Outcome",
		"A test spec for pulse command",
		"",
		"## Acceptance Criteria",
		"",
		...acs,
		"",
	];
	writeFileSync(join(specDir, "spec.md"), content.join("\n"));
}

function writeHealthRecord(dir: string, entries: Record<string, unknown>[]) {
	writeFileSync(
		join(dir, ".letra", "health-record.json"),
		JSON.stringify({ schemaVersion: 1, lastScanAt: new Date().toISOString(), entries }, null, 2),
	);
}

describe("pulse", () => {
	let dir: string;

	beforeEach(() => {
		dir = createTestDir();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(dir, { recursive: true, force: true });
	});

	it("should return JSON with current item", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.workspace).toBe("test-project");
		expect(result.dataDir).toBe(join(dir, ".letra"));
		expect(result.locationPath).toBe(dir);
		expect(result.currentItem).not.toBeNull();
		expect(result.currentItem!.id).toBe("ITEM-1");
		expect(result.currentItem!.description).toBe("Feature X");
		expect(result.currentItem!.stage).toBe("code");
		expect(result.currentItem!.stageName).toBe("Code");
		expect(result.currentItem!.daysInStage).toBe(3);
		expect(result.currentItem!.spec).toBe("feature-x");
	});

	it("should count ACs from spec", async () => {
		writeWorkflow(dir);
		writeSpec(dir, "feature-x", [
			"- [ ] **AC-1**: Login works",
			"- [ ] **AC-2**: Logout works",
			"- [x] **AC-3**: Signup works",
		]);
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.acs).toEqual({ pending: 2, done: 1, total: 3 });
	});

	it("should return ACs as zero when no spec file", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.acs).toEqual({ pending: 0, done: 0, total: 0 });
	});

	it("should include task counts when item has tasks", async () => {
		writeWorkflow(dir, {
			items: [
				{
					id: "ITEM-1",
					description: "Feature X",
					stage: "code",
					createdAt: new Date().toISOString(),
					tasks: [
						{ id: "t1", description: "Task 1", done: true },
						{ id: "t2", description: "Task 2", done: false },
						{ id: "t3", description: "Task 3", done: false },
					],
				},
			],
		});
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.tasks).toEqual({ open: 2, done: 1, total: 3 });
	});

	it("should return empty tasks when no tasks", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.tasks).toEqual({ open: 0, done: 0, total: 0 });
	});

	it("should include health alert counts", async () => {
		writeWorkflow(dir);
		writeHealthRecord(dir, [
			{ id: "a1", status: "novo", severity: "alta", type: "error", title: "Erro grave", source: "test", detectedAt: new Date().toISOString(), resolvedAt: null, dismissedAt: null, dismissReason: null, acknowledgedAt: null },
			{ id: "a2", status: "novo", severity: "media", type: "warning", title: "Warning", source: "test", detectedAt: new Date().toISOString(), resolvedAt: null, dismissedAt: null, dismissReason: null, acknowledgedAt: null },
			{ id: "a3", status: "ciente", severity: "baixa", type: "info", title: "Info", source: "test", detectedAt: new Date().toISOString(), resolvedAt: null, dismissedAt: null, dismissReason: null, acknowledgedAt: null },
			{ id: "a4", status: "resolvido", severity: "media", type: "warning", title: "Fixed", source: "test", detectedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), dismissedAt: null, dismissReason: null, acknowledgedAt: null },
		]);
		const result = await pulse(dir, { json: true });

		expect(result.alerts.novo).toBe(2);
		expect(result.alerts.acknowledged).toBe(1);
		expect(result.alerts.resolved).toBe(1);
		expect(result.alerts.dismissed).toBe(0);
		expect(result.alerts.highSeverity).toBe(1);
	});

	it("should return zero alerts when no health record", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.alerts).toEqual({ novo: 0, acknowledged: 0, resolved: 0, dismissed: 0, highSeverity: 0 });
	});

	it("should show next item from backlog", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.nextItem).not.toBeNull();
		expect(result.nextItem!.id).toBe("ITEM-2");
		expect(result.nextItem!.description).toBe("Bug fix Y");
	});

	it("should return null currentItem when no active item", async () => {
		writeWorkflow(dir, { items: [] });
		const result = await pulse(dir, { json: true });

		expect(result.currentItem).toBeNull();
	});

	it("should not crash when no workflow exists", async () => {
		const result = await pulse(dir, { json: true });

		expect(result.workspace).toBe("meu-projeto");
		expect(result.currentItem).toBeNull();
	});

	it("should show daysIdle from workflow updatedAt", async () => {
		const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
		writeWorkflow(dir, { updatedAt: oldDate });
		const result = await pulse(dir, { json: true });

		expect(result.daysIdle).toBe(5);
	});

	it("should return null daysIdle when no workflow", async () => {
		const result = await pulse(dir, { json: true });

		expect(result.daysIdle).toBeNull();
	});

	it("should include spec path when item has spec", async () => {
		writeWorkflow(dir);
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.spec).toBe("feature-x");
	});

	it("should display clickable file URLs in text output", async () => {
		writeWorkflow(dir);
		writeSpec(dir, "feature-x", ["- [ ] **AC-1**: Login works"]);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await pulse(dir);

		const output = log.mock.calls.flat().join("\n");
		expect(output).toContain(
			pathToFileURL(join(dir, ".letra", "specs", "feature-x", "spec.md")).href,
		);
		expect(output).toContain(pathToFileURL(join(dir, ".letra", "workflow.json")).href);
	});

	it("warns when running from a legacy local workspace", async () => {
		writeWorkflow(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const result = await pulse(dir);

		expect(result.legacyWarning).toContain("Workspace legado local detectado");
		const output = log.mock.calls.flat().join("\n");
		expect(output).toContain("Workspace legado local detectado");
	});

	it("should return null spec when item has no spec", async () => {
		writeWorkflow(dir, {
			items: [
				{ id: "ITEM-1", description: "Feature X", stage: "code", createdAt: new Date().toISOString() },
			],
		});
		const result = await pulse(dir, { json: true });

		expect(result.currentItem!.spec).toBeNull();
	});
});
