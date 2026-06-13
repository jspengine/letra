import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	backlogImportGitHub,
	backlogImportLinear,
} from "./flow-import-issues.js";
import { type Workflow, saveWorkflow } from "./flow-init.js";

function createTestWorkflow(): Workflow {
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
		items: [],
		tools: ["cursor"],
	};
}

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	}) as unknown as ReturnType<typeof vi.fn>;
}

describe("flow-import-issues", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-flow-import-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("backlogImportGitHub", () => {
		it("should import open issues from GitHub", async () => {
			vi.stubGlobal(
				"fetch",
				mockFetch(200, [
					{
						title: "Fix login bug",
						html_url: "https://github.com/owner/repo/issues/1",
						number: 1,
						labels: [{ name: "bug" }],
					},
					{
						title: "Add dark mode",
						html_url: "https://github.com/owner/repo/issues/2",
						number: 2,
						labels: [],
					},
				]),
			);

			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const result = await backlogImportGitHub(tmpDir, "owner/repo");

			expect(result.imported).toBe(2);
			expect(result.total).toBe(2);

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items).toHaveLength(2);
			expect(loaded.items[0].description).toContain("[1] Fix login bug");
			expect(loaded.items[0].description).toContain("(bug)");
			expect(loaded.items[0].source).toBe("github");
			expect(loaded.items[0].sourceUrl).toBe(
				"https://github.com/owner/repo/issues/1",
			);
			expect(loaded.items[1].description).toBe("[2] Add dark mode");
		});

		it("should filter pull requests from results", async () => {
			vi.stubGlobal(
				"fetch",
				mockFetch(200, [
					{
						title: "Fix login bug",
						html_url: "https://github.com/owner/repo/pull/1",
						number: 1,
						pull_request: {},
					},
					{
						title: "Actual issue",
						html_url: "https://github.com/owner/repo/issues/2",
						number: 2,
					},
				]),
			);

			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const result = await backlogImportGitHub(tmpDir, "owner/repo");

			expect(result.imported).toBe(1);
			expect(result.total).toBe(1);
		});

		it("should exit if no workflow exists", async () => {
			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit");
			});

			await expect(backlogImportGitHub(tmpDir, "owner/repo")).rejects.toThrow(
				"process.exit",
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		});

		it("should exit on API error", async () => {
			vi.stubGlobal("fetch", mockFetch(404, { message: "Not found" }));
			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit");
			});

			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			await expect(
				backlogImportGitHub(tmpDir, "owner/private-repo"),
			).rejects.toThrow("process.exit");
			expect(exitSpy).toHaveBeenCalledWith(1);
		});
	});

	describe("backlogImportLinear", () => {
		it("should import issues from Linear team", async () => {
			vi.stubGlobal(
				"fetch",
				mockFetch(200, {
					data: {
						team: {
							issues: {
								nodes: [
									{
										id: "linear-1",
										title: "Setup CI pipeline",
										url: "https://linear.app/team/issue/CI-1",
										identifier: "CI-1",
									},
									{
										id: "linear-2",
										title: "Add tests",
										url: "https://linear.app/team/issue/CI-2",
										identifier: "CI-2",
									},
								],
							},
						},
					},
				}),
			);

			vi.stubEnv("LINEAR_API_KEY", "lin_api_test");

			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			const result = await backlogImportLinear(tmpDir, "CI");

			expect(result.imported).toBe(2);

			const loaded = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			);
			expect(loaded.items).toHaveLength(2);
			expect(loaded.items[0].description).toBe("CI-1 Setup CI pipeline");
			expect(loaded.items[0].source).toBe("linear");
			expect(loaded.items[0].sourceUrl).toBe(
				"https://linear.app/team/issue/CI-1",
			);
		});

		it("should exit if LINEAR_API_KEY is missing", async () => {
			const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit");
			});

			const workflow = createTestWorkflow();
			saveWorkflow(tmpDir, workflow);

			await expect(backlogImportLinear(tmpDir, "CI")).rejects.toThrow(
				"process.exit",
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		});
	});
});
