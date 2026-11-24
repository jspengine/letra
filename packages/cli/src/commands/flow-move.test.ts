import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Workflow, saveWorkflow } from "./flow-init.js";
import { flowMove, flowMoveAction } from "./flow-move.js";
import { directionForRunAwareOperation, requestPassageOperation } from "../domain-operations/service.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";

vi.mock("../domain-operations/service.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../domain-operations/service.js")>()),
	requestPassageOperation: vi.fn(async () => ({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED" })),
	// The revision passage compares: run-aware and bound to the claim's executor.
	directionForRunAwareOperation: vi.fn(() => ({ revision: "sha256:item-revision" })),
}));
vi.mock("../flow-definition/resolve.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../flow-definition/resolve.js")>()),
	resolveActiveFlow: vi.fn(() => ({ flow: { stages: [{ id: "backlog", roleIds: [], agents: [] }, { id: "design", roleIds: ["designer"], agents: ["designer"] }, { id: "code", roleIds: ["builder", "reviewer"], agents: ["builder", "reviewer"] }, { id: "review", roleIds: ["reviewer"], agents: ["reviewer"] }, { id: "done", roleIds: ["reviewer"], agents: ["reviewer"] }] } })),
}));

function createTestWorkflow(): Workflow {
	return {
		version: "1.0", name: "test", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0 }, { id: "design", name: "Design", order: 1 },
			{ id: "code", name: "Code", order: 2 }, { id: "review", name: "Review", order: 3 }, { id: "done", name: "Done", order: 4 },
		],
		items: [{ id: "ITEM-1", description: "First task", stage: "backlog", createdAt: "2026-01-01T00:00:00.000Z", claimedBy: "designer", claimExecutorId: "codex" }],
		tools: ["cursor"],
	};
}

describe("flow-move uses canonical passage", () => {
	let root: string;
	beforeEach(() => {
		root = join(tmpdir(), `letra-flow-move-test-${Date.now()}`);
		mkdirSync(root, { recursive: true });
		vi.clearAllMocks();
		saveWorkflow(root, createTestWorkflow());
	});
	afterEach(() => { if (existsSync(root)) rmSync(root, { recursive: true, force: true }); });

	it("submits the item revision and sole destination role to canonical passage", async () => {
		await flowMove(root, "ITEM-1", "design");
		expect(requestPassageOperation).toHaveBeenCalledWith(root, expect.objectContaining({
			itemId: "ITEM-1", targetStageId: "design", to: "designer", executorId: "codex", expectedRevision: "sha256:item-revision",
			summary: expect.stringContaining("Backlog → Design"),
		}));
		expect(directionForRunAwareOperation).toHaveBeenCalledWith(root, { itemId: "ITEM-1", runId: undefined, executorId: "codex" });
	});

	it("requires an explicit Run when selecting the revision", async () => {
		await flowMove(root, "ITEM-1", "design", { run: "run-123" });
		expect(directionForRunAwareOperation).toHaveBeenCalledWith(root, { itemId: "ITEM-1", runId: "run-123", executorId: "codex" });
		expect(requestPassageOperation).toHaveBeenCalledWith(root, expect.objectContaining({ runId: "run-123" }));
	});

	it("refuses to move when there is no active claim", async () => {
		const workflow = createTestWorkflow();
		delete workflow.items[0].claimExecutorId;
		saveWorkflow(root, workflow);
		await flowMove(root, "ITEM-1", "design");
		expect(requestPassageOperation).not.toHaveBeenCalled();
	});

	it("requires a sole destination role instead of guessing among multiple roles", async () => {
		vi.mocked(resolveActiveFlow).mockReturnValueOnce({ flow: { stages: [{ id: "code", roleIds: ["builder", "reviewer"], agents: ["builder", "reviewer"] }] } } as any);
		const logs: string[] = [];
		const original = console.log;
		console.log = (message: string) => logs.push(message);
		try { await flowMove(root, "ITEM-1", "code"); } finally { console.log = original; }
		expect(logs.join(" ")).toContain("múltiplos destinatários");
		expect(requestPassageOperation).not.toHaveBeenCalled();
	});
});

// ITEM-25 / spec recusas-que-ensinam AC6: a refused passage must not exit 0.
type PassageResult = Awaited<ReturnType<typeof requestPassageOperation>>;
describe("flow move exit code", () => {
	let root: string;
	let previousExitCode: typeof process.exitCode;
	beforeEach(() => {
		root = join(tmpdir(), `letra-flow-move-exit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		mkdirSync(root, { recursive: true });
		vi.clearAllMocks();
		saveWorkflow(root, createTestWorkflow());
		previousExitCode = process.exitCode;
		process.exitCode = undefined;
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});
	afterEach(() => {
		process.exitCode = previousExitCode;
		vi.mocked(console.log).mockRestore();
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});

	it("reports success, idempotent no-op and pending human approval as reached", async () => {
		expect(await flowMove(root, "ITEM-1", "design")).toBe(true);
		expect(await flowMove(root, "ITEM-1", "backlog")).toBe(true);
		vi.mocked(requestPassageOperation).mockResolvedValueOnce({ outcome: "approval-required", reasonCode: "HUMAN_APPROVAL_REQUIRED", reason: "gate" } as PassageResult);
		expect(await flowMove(root, "ITEM-1", "design")).toBe(true);
	});

	it("reports every refusal as not reached", async () => {
		expect(await flowMove(root, "ITEM-404", "design")).toBe(false);
		expect(await flowMove(root, "ITEM-1", "nowhere")).toBe(false);
		vi.mocked(requestPassageOperation).mockResolvedValueOnce({ outcome: "rejected", reasonCode: "CLAIM_REQUIRED", reason: "sem claim" } as PassageResult);
		expect(await flowMove(root, "ITEM-1", "design")).toBe(false);
		const workflow = createTestWorkflow();
		workflow.items[0].stage = "done";
		saveWorkflow(root, workflow);
		expect(await flowMove(root, "ITEM-1", "", { auto: true })).toBe(false);
	});

	it("exits 1 when the passage is refused", async () => {
		vi.mocked(requestPassageOperation).mockResolvedValueOnce({ outcome: "rejected", reasonCode: "CLAIM_REQUIRED", reason: "sem claim" } as PassageResult);
		await flowMoveAction(root, "ITEM-1", { to: "design" });
		expect(process.exitCode).toBe(1);
	});

	it("exits 1 when the passage throws instead of leaving an unhandled rejection", async () => {
		vi.mocked(requestPassageOperation).mockRejectedValueOnce(new Error("disk full"));
		await flowMoveAction(root, "ITEM-1", { to: "design" });
		expect(process.exitCode).toBe(1);
	});

	it("keeps exit 0 when the item moves", async () => {
		await flowMoveAction(root, "ITEM-1", { to: "design" });
		expect(process.exitCode).toBeUndefined();
	});
});
