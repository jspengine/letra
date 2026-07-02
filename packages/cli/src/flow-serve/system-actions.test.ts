import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getRecurringSystemActions, logSystemAction } from "./system-actions.js";

const dirs: string[] = [];

function makeRoot(): string {
	const root = join(tmpdir(), `letra-system-actions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
	mkdirSync(join(root, ".letra"), { recursive: true });
	dirs.push(root);
	return root;
}

afterEach(async () => {
	const { rmSync } = await import("node:fs");
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("system actions", () => {
	it("returns recurring actions even before execution", () => {
		const root = makeRoot();
		const actions = getRecurringSystemActions(root);
		expect(actions.map((action) => action.id)).toEqual([
			"workflow-watch",
			"specs-watch",
			"diagnostics-scan",
		]);
		expect(actions.every((action) => action.lastRunAt === null)).toBe(true);
	});

	it("captures last outcome and timestamp from system log", () => {
		const root = makeRoot();
		logSystemAction(root, "diagnostics-scan", {
			outcome: "armed",
		});
		logSystemAction(root, "diagnostics-scan", {
			outcome: "completed",
			details: { reason: "startup", suggestions: 2 },
		});

		const diagnostics = getRecurringSystemActions(root).find((action) => action.id === "diagnostics-scan");
		expect(diagnostics?.lastOutcome).toBe("completed");
		expect(diagnostics?.status).toBe("success");
		expect(diagnostics?.lastRunAt).toEqual(expect.any(String));
	});
});
