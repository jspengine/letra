import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { status } from "./status.js";

describe("status", () => {
	let root: string;

	beforeEach(() => {
		root = join(tmpdir(), `letra-status-${Date.now()}`);
		mkdirSync(root, { recursive: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});

	it("displays the detected manifest as a clickable file URL", async () => {
		const manifestPath = join(root, "letra.manifest.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				schemaVersion: "1.0",
				projectId: "project-test",
				workspaceId: "workspace-test",
				templateId: "sdlc",
				harnessVersion: "v0.1.0",
				repositories: [],
				gates: [],
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await status(root);

		expect(log.mock.calls.flat().join("\n")).toContain(pathToFileURL(manifestPath).href);
	});
});
