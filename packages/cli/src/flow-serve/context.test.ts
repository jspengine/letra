import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildActivityContext } from "../activity-context/index.js";
import { buildRequestedActivityContext } from "./context.js";

describe("flow-serve activity context", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) rmSync(root, { recursive: true, force: true });
		roots.length = 0;
	});

	it("uses the same projection consumed by the CLI", () => {
		const root = join(tmpdir(), `letra-activity-consumer-${Date.now()}`);
		roots.push(root);
		mkdirSync(join(root, ".letra"), { recursive: true });

		const cliProjection = buildActivityContext({ activity: "design", workspaceRoot: root });
		const webProjection = buildRequestedActivityContext(root, "design");

		expect(webProjection).toEqual(cliProjection);
	});
});
