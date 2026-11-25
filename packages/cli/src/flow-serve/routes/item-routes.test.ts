import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../commands/flow-init.js";
import { createRequestContext } from "../request-context.js";
import { createItemRoutes, type ItemRouteDependencies } from "./item-routes.js";

vi.mock("../../identity/signing.js", () => ({ signLocalOperation: vi.fn(() => ({ issuedAt: "2026-07-01T00:00:00.000Z", nonce: "a".repeat(32), signature: "test" })) }));

function workflow(): Workflow {
	return {
		version: "1.0",
		name: "Test",
		createdAt: "2026-07-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "done", name: "Done", order: 1, zone: "done" },
		],
		items: [],
		tools: [],
	};
}

function request(method: string, body = ""): IncomingMessage {
	const req = Readable.from(body ? [body] : []) as IncomingMessage;
	req.method = method;
	return req;
}

function response() {
	return {
		writeHead: vi.fn(),
		end: vi.fn(),
	} as unknown as ServerResponse;
}

function dependencies() {
	const writeWorkflow = vi.fn();
	const logEntry = vi.fn();
	const loadHealthRecord = vi.fn().mockReturnValue({
		entries: [
			{ id: "drift_ITEM-56_spec", status: "novo" },
			{ id: "other_ITEM-56_test", status: "novo" },
			{ id: "old_ITEM-56_test", status: "resolvido" },
		],
	});
	const createItemOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "ITEM_CREATED", auditId: "log-item", nextDirection: {} });
	const updateItemOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "ITEM_UPDATED", auditId: "log-item", nextDirection: {} });
	const deleteItemOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "ITEM_DELETED", auditId: "log-item", nextDirection: {} });
	const decideGateOperation = vi.fn();
	const requestTransitionOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "TRANSITION_COMPLETED", auditId: "log-transition", nextDirection: {} });
	const requestPassageOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "PASSAGE_COMPLETED", auditId: "log-passage", nextDirection: { item: { id: "ITEM-1", stage: "review" } } });
	const claimOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "CLAIM_ACCEPTED", auditId: "log-claim", nextDirection: {} });
	const releaseClaimOperation = vi.fn().mockResolvedValue({ outcome: "accepted", reasonCode: "CLAIM_RELEASED", auditId: "log-release", nextDirection: {} });
	const deps = {
		writeWorkflow,
		loadHealthRecord,
		writeFocusFile: vi.fn(),
		logEntry,
		resolveActiveFlow: vi.fn().mockReturnValue({ flow: null, warnings: [] }),
		broadcast: vi.fn(),
		fireWebhooks: vi.fn().mockResolvedValue(undefined),
		createItemOperation,
		updateItemOperation,
		deleteItemOperation,
		decideGateOperation,
		requestTransitionOperation,
		requestPassageOperation,
		claimOperation,
		releaseClaimOperation,
		resolveHumanActor: vi.fn().mockReturnValue("human:web-ui"),
	} as unknown as ItemRouteDependencies;
	return { deps, writeWorkflow, loadHealthRecord, logEntry, createItemOperation, decideGateOperation, requestTransitionOperation, requestPassageOperation, claimOperation };
}

function reviewWorkflow(claimedBy?: string): Workflow {
	const base = workflow();
	return {
		...base,
		stages: [
			{ id: "review", name: "Review", order: 0, zone: "doing" },
			{ id: "security", name: "Security", order: 1, zone: "doing" },
			{ id: "done", name: "Done", order: 2, zone: "done" },
		],
		items: [{
			id: "ITEM-3",
			description: "Review me",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
			...(claimedBy ? { claimedBy, claimExecutorId: "web-ui", claimCapability: "read_code" } : {}),
			handoff: { from: "developer", to: "reviewer", summary: "Pronto", evidence: [], timestamp: "2026-07-01T00:00:00.000Z", expiresAt: "2999-01-01T00:00:00.000Z", executorId: "claude-code" },
		}],
	} as Workflow;
}

describe("ITEM-44: board passage Review -> Security", () => {
	it("claims for the active handoff role instead of the human session", async () => {
		const { deps, claimOperation } = dependencies();
		const res = response();
		const body = JSON.stringify({ role: "reviewer", capability: "read_code", executorId: "web-ui", expectedRevision: "revision-1" });
		const context = createRequestContext(request("POST", body), res, new URL("http://localhost/api/items/ITEM-3/claim"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: reviewWorkflow() });
		await createItemRoutes(deps)(context as any);
		expect(claimOperation).toHaveBeenCalledWith("C:\\workspace", expect.objectContaining({
			itemId: "ITEM-3",
			actor: "reviewer",
			capability: "read_code",
			executorId: "web-ui",
			reason: expect.stringContaining("human:web-ui"),
		}));
		expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
	});

	it("refuses to claim as another identity through the role field", async () => {
		for (const role of ["human:someone-else", "mcp:codex", "human"]) {
			const { deps, claimOperation } = dependencies();
			const res = response();
			const context = createRequestContext(request("POST", JSON.stringify({ role })), res, new URL("http://localhost/api/items/ITEM-3/claim"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: reviewWorkflow() });
			await createItemRoutes(deps)(context as any);
			expect(claimOperation).not.toHaveBeenCalled();
			expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
		}
	});

	it("passes the item as the role that holds the source claim, keeping the human as requester", async () => {
		const { deps, requestPassageOperation } = dependencies();
		const res = response();
		const body = JSON.stringify({ targetStageId: "security", to: "security", executorId: "web-ui", summary: "Revisão concluída", evidence: [], expectedRevision: "revision-2" });
		const context = createRequestContext(request("POST", body), res, new URL("http://localhost/api/items/ITEM-3/passage"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: reviewWorkflow("reviewer") });
		await createItemRoutes(deps)(context as any);
		expect(requestPassageOperation).toHaveBeenCalledWith("C:\\workspace", expect.objectContaining({
			itemId: "ITEM-3",
			targetStageId: "security",
			to: "security",
			actor: "reviewer",
			reason: expect.stringContaining("solicitada por human:web-ui"),
		}));
		expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
	});
});

it("routes an explicit web passage through the canonical passage operation", async () => {
	const { deps, requestPassageOperation } = dependencies();
	const res = response();
	const body = JSON.stringify({ targetStageId: "review", to: "reviewer", executorId: "codex", summary: "Ready", evidence: ["tests passed"], expectedRevision: "revision-1" });
	const context = createRequestContext(request("POST", body), res, new URL("http://localhost/api/items/ITEM-1/passage"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: workflow() });
	await createItemRoutes(deps)(context as any);
	expect(requestPassageOperation).toHaveBeenCalledWith("C:\\workspace", expect.objectContaining({ itemId: "ITEM-1", targetStageId: "review", to: "reviewer", executorId: "codex", actor: "human:web-ui", expectedRevision: "revision-1" }));
	expect(deps.broadcast).toHaveBeenCalledOnce();
	expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
});

it("preserves the passage reason code and recovery actions in HTTP errors", async () => {
	const { deps, requestPassageOperation } = dependencies();
	vi.mocked(requestPassageOperation).mockResolvedValue({ outcome: "rejected", reasonCode: "CLAIM_EXPIRED", reason: "Claim expirado.", recoveryActions: ["Adquira nova claim."] } as any);
	const res = response();
	const body = JSON.stringify({ targetStageId: "review", to: "reviewer", executorId: "codex", summary: "Ready", expectedRevision: "revision-1" });
	const context = createRequestContext(request("POST", body), res, new URL("http://localhost/api/items/ITEM-1/passage"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: workflow() });
	await createItemRoutes(deps)(context as any);
	expect(res.writeHead).toHaveBeenCalledWith(422, expect.any(Object));
	expect(res.end).toHaveBeenCalledWith(expect.stringContaining("CLAIM_EXPIRED"));
	expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Adquira nova claim."));
});

function configureHumanGate(
	deps: ItemRouteDependencies,
	decisions: Record<string, string> | null = {
		approve: "next",
		"request-changes": "previous",
		reject: "first",
	},
	gateStageId = "review",
) {
	vi.mocked(deps.resolveActiveFlow).mockReturnValue({
		workflow: null,
		harness: null,
		template: null,
		flow: {
			id: "test-flow",
			source: "workflow-template",
			harnessVersion: "v0.1.3",
			templateVersion: "0.1.3",
			name: "Test flow",
			operations: {},
			roles: [],
			warnings: [],
			stages: [
				{
					id: "backlog",
					name: "Backlog",
					order: 0,
					zone: "todo",
					roleIds: [],
					roles: [],
					agents: [],
					gate: null,
					provenance: "harness",
				},
				{
					id: gateStageId,
					name: gateStageId === "security" ? "Security" : "Review",
					order: 1,
					zone: "doing",
					roleIds: [],
					roles: [],
					agents: [],
					gate: {
						id: "human-review",
						name: "Human Review",
						type: "human",
						blocking: true,
						description: "Human decision required",
						decisions: decisions ?? undefined,
					},
					provenance: "harness",
				},
				{
					id: "code",
					name: "Code",
					order: 2,
					zone: "doing",
					roleIds: [],
					roles: [],
					agents: [],
					gate: null,
					provenance: "harness",
				},
				{
					id: "done",
					name: "Done",
					order: 3,
					zone: "done",
					roleIds: [],
					roles: [],
					agents: [],
					gate: null,
					provenance: "harness",
				},
			],
		},
	});
}

function workflowAtGate(): Workflow {
	const value = workflow();
	value.stages = [
		{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
		{ id: "review", name: "Review", order: 1, zone: "doing" },
		{ id: "code", name: "Code", order: 2, zone: "doing" },
	];
	value.items = [
		{
			id: "ITEM-1",
			description: "First item",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
		},
		{
			id: "ITEM-2",
			description: "Second item",
			stage: "review",
			createdAt: "2026-07-01T00:00:00.000Z",
			spec: "second-item",
		},
	];
	return value;
}

describe("item routes", () => {
	it("owns the single item-alert route", async () => {
		const { deps, loadHealthRecord } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("GET"),
			res,
			new URL("http://localhost/api/items/alerts"),
			{
				workspaceRoot: "C:\\workspace-a",
				workspaceDir: "C:\\workspace-a\\.letra",
				workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(loadHealthRecord).toHaveBeenCalledWith("C:\\workspace-a");
		expect(res.end).toHaveBeenCalledWith('{"itemAlerts":{"ITEM-56":2}}');
	});

	it("persists item mutations in the request workspace", async () => {
		const { deps, writeWorkflow, createItemOperation } = dependencies();
		vi.mocked(deps.resolveHumanActor!).mockReturnValue("human:web-ui");
		const res = response();
		const context = createRequestContext(
			request("POST", '{"id":"ITEM-9","description":"Extract routes","stage":"backlog","expectedRevision":"sha256:create"}'),
			res,
			new URL("http://localhost/api/items"),
			{
				workspaceRoot: "C:\\workspace-b",
				workspaceDir: "C:\\workspace-b\\.letra",
			workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(createItemOperation).toHaveBeenCalledWith(
			"C:\\workspace-b",
			expect.objectContaining({ id: "ITEM-9", actor: "human:web-ui" }),
		);
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	// ITEM-64: the board sends only the description; the canonical operation
	// assigns the next ITEM-N and the first stage.
	it("creates an item from a description alone", async () => {
		const { deps, createItemOperation } = dependencies();
		deps.resolveHumanActor = vi.fn().mockReturnValue("human:web-ui");
		const res = response();
		const context = createRequestContext(
			request("POST", '{"description":"  Exportar o board em CSV  ","expectedRevision":"sha256:create"}'),
			res,
			new URL("http://localhost/api/items"),
			{ workspaceRoot: "C:\\workspace-b", workspaceDir: "C:\\workspace-b\\.letra", workflow: workflow() },
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		const input = vi.mocked(createItemOperation).mock.calls[0]?.[1] as Record<string, unknown>;
		expect(input).toMatchObject({ description: "Exportar o board em CSV", actor: "human:web-ui" });
		expect(input).not.toHaveProperty("id");
		expect(input).not.toHaveProperty("stage");
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	it("refuses an item without description", async () => {
		const { deps, createItemOperation } = dependencies();
		deps.resolveHumanActor = vi.fn().mockReturnValue("human:web-ui");
		const res = response();
		const context = createRequestContext(
			request("POST", '{"description":"   "}'),
			res,
			new URL("http://localhost/api/items"),
			{ workspaceRoot: "C:\\workspace-b", workspaceDir: "C:\\workspace-b\\.letra", workflow: workflow() },
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(createItemOperation).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
	});

	it("returns the stable malformed-body response", async () => {
		const { deps, writeWorkflow } = dependencies();
		const res = response();
		const context = createRequestContext(
			request("POST", "{"),
			res,
			new URL("http://localhost/api/items"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflow(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith('{"error":"Malformed JSON request body"}');
	});

	it("delegates web validation to the canonical operation", async () => {
		const { deps } = dependencies();
		const runValidationOperation = vi.fn().mockResolvedValue({
			outcome: "accepted",
			reasonCode: "VALIDATION_COMPLETED",
			auditId: "log-validation",
		});
		deps.runValidationOperation = runValidationOperation;
		const res = response();
		const context = createRequestContext(
			request("POST", '{"itemId":"ITEM-1","expectedRevision":"sha256:web","reason":"Validate before review"}'),
			res,
			new URL("http://localhost/api/operations/validate"),
			{ workspaceRoot: "C:\\workspace-b", workspaceDir: "C:\\workspace-b\\.letra", workflow: workflow() },
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
			expect(runValidationOperation).toHaveBeenCalledWith("C:\\workspace-b", {
			itemId: "ITEM-1",
			expectedRevision: "sha256:web",
			reason: "Validate before review",
			actor: "human:web-ui",
		});
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	it("applies and audits a gate decision for the requested item only", async () => {
		const { deps, writeWorkflow, logEntry, decideGateOperation } = dependencies();
		configureHumanGate(deps);
		const value = workflowAtGate();
		decideGateOperation.mockImplementation(async (_root: string, input: { itemId: string }) => {
			const target = value.items.find((item) => item.id === input.itemId)!;
			target.stage = "code";
			return { outcome: "accepted", reasonCode: "GATE_DECISION_RECORDED", auditId: "log-gate", nextDirection: { item: target } };
		});
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"approve"}'),
			res,
			new URL("http://localhost/api/items/ITEM-2/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: value,
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(value.items[0].stage).toBe("review");
		expect(value.items[1].stage).toBe("code");
		expect(decideGateOperation).toHaveBeenCalledWith("C:\\workspace", expect.objectContaining({ itemId: "ITEM-2", actor: "human:web-ui", decision: "approve" }));
		expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
	});

	it("requires a reason for request-changes and reject", async () => {
		const { deps, writeWorkflow, logEntry } = dependencies();
		configureHumanGate(deps);
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"reject"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflowAtGate(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(logEntry).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
	});

	it("rejects a forged actor in the request body without a human session", async () => {
		const { deps, decideGateOperation } = dependencies();
		vi.mocked(deps.resolveHumanActor!).mockReturnValue(null);
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"approve","actor":"human:admin"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1/gate-decisions"),
			{ workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: workflowAtGate() },
		);
		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);
		expect(decideGateOperation).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(403, { "Content-Type": "application/json" });
	});

	it("rejects safely when the harness does not define decision targets", async () => {
		const { deps, writeWorkflow, decideGateOperation } = dependencies();
		configureHumanGate(deps, null);
		decideGateOperation.mockResolvedValue({ outcome: "rejected", reasonCode: "INVALID_GATE_DECISION", reason: "does not define decision targets", auditId: "log-rejected", nextDirection: {} });
		const res = response();
		const context = createRequestContext(
			request("POST", '{"decision":"approve"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1/gate-decisions"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: workflowAtGate(),
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(422, { "Content-Type": "application/json" });
		expect(res.end).toHaveBeenCalledWith(expect.stringContaining("does not define"));
	});

	it("prevents the generic patch route from bypassing a human gate", async () => {
		const { deps, writeWorkflow, logEntry, requestTransitionOperation } = dependencies();
		configureHumanGate(deps);
		const value = workflowAtGate();
		requestTransitionOperation.mockResolvedValue({ outcome: "rejected", reasonCode: "HUMAN_APPROVAL_REQUIRED", reason: "decisão humana explícita necessária", auditId: "log-rejected", nextDirection: {} });
		const res = response();
		const context = createRequestContext(
			request("PATCH", '{"stage":"code"}'),
			res,
			new URL("http://localhost/api/items/ITEM-1"),
			{
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				workflow: value,
			},
		);

		await expect(createItemRoutes(deps)(context)).resolves.toBe(true);

		expect(value.items[0].stage).toBe("review");
		expect(writeWorkflow).not.toHaveBeenCalled();
		expect(logEntry).not.toHaveBeenCalled();
		expect(res.writeHead).toHaveBeenCalledWith(422, { "Content-Type": "application/json" });
		expect(requestTransitionOperation).not.toHaveBeenCalled();
		expect(res.end).toHaveBeenCalledWith(expect.stringContaining("canonical /passage operation"));
	});

	it("resolves the final human-approved gate to Done or back to Code", async () => {
		const { deps, writeWorkflow, logEntry, decideGateOperation } = dependencies();
		const value = workflowAtGate();
		value.stages = [
			{ id: "security", name: "Security", order: 1, zone: "doing" },
			{ id: "code", name: "Code", order: 2, zone: "doing" },
			{ id: "done", name: "Done", order: 3, zone: "done" },
		];
		value.items = [{ id: "ITEM-1", description: "", stage: "security", createdAt: "" }];
		configureHumanGate(deps, { approve: "done", "request-changes": "code", reject: "code" }, "security");
		decideGateOperation.mockImplementation(async () => {
			value.items[0].stage = "done";
			value.items[0].handoff = undefined;
			return { outcome: "accepted", reasonCode: "GATE_DECISION_RECORDED", auditId: "log-gate", nextDirection: { item: value.items[0] } };
		});
		const res = response();
		const context = createRequestContext(request("POST", '{"decision":"approve"}'), res, new URL("http://localhost/api/items/ITEM-1/gate-decisions"), { workspaceRoot: "C:\\workspace", workspaceDir: "C:\\workspace\\.letra", workflow: value });
		await createItemRoutes(deps)(context);
		expect(value.items[0].stage).toBe("done");
		expect(value.items[0].handoff).toBeUndefined();
		expect(decideGateOperation).toHaveBeenCalledWith("C:\\workspace", expect.objectContaining({ itemId: "ITEM-1", actor: "human:web-ui", decision: "approve" }));
	});
});
