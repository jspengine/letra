import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printJson } from "./operation.js";

// ITEM-25 / spec recusas-que-ensinam AC7: `letra operation *` and
// `letra security review` print through printJson, which mirrors the outcome
// in the exit code.
describe("operation exit code", () => {
	let previousExitCode: typeof process.exitCode;
	beforeEach(() => {
		previousExitCode = process.exitCode;
		process.exitCode = undefined;
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	});
	afterEach(() => {
		process.exitCode = previousExitCode;
		vi.restoreAllMocks();
	});

	it("exits 1 for a rejected operation", () => {
		printJson({ outcome: "rejected", reasonCode: "CLAIM_REQUIRED" });
		expect(process.exitCode).toBe(1);
	});

	it.each([
		["accepted", { outcome: "accepted", reasonCode: "CLAIM_ACCEPTED" }],
		["approval-required", { outcome: "approval-required", reasonCode: "HUMAN_APPROVAL_REQUIRED" }],
		["read-only payload without outcome", { items: [] }],
	])("keeps exit 0 for %s", (_label, value) => {
		printJson(value);
		expect(process.exitCode).toBeUndefined();
	});

	it("still prints the full result before setting the exit code", () => {
		printJson({ outcome: "rejected", reasonCode: "DIRECTION_STALE" });
		expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("DIRECTION_STALE"));
	});
});
