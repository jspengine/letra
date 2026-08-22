import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FlowServer } from "./flow-serve.js";
import { saveWorkflow, type Item, type Workflow } from "./flow-init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliEntry = resolve(__dirname, "..", "index.ts");

function createTestWorkflow(overrides?: Partial<Workflow>): Workflow {
	return {
		version: "1.0",
		name: "integration-test",
		createdAt: "2026-06-17T00:00:00.000Z",
		updatedAt: "2026-06-17T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "design", name: "Design", order: 1, zone: "doing" },
			{ id: "code", name: "Code", order: 2, zone: "doing" },
			{ id: "review", name: "Review", order: 3, zone: "doing" },
			{ id: "done", name: "Done", order: 4, zone: "done" },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Active work item",
				stage: "code",
				createdAt: "2026-06-17T00:00:00.000Z",
				spec: "auth",
			},
			{
				id: "ITEM-2",
				description: "Backlog item",
				stage: "backlog",
				createdAt: "2026-06-17T00:00:00.000Z",
			},
			{
				id: "ITEM-3",
				description: "Completed item",
				stage: "done",
				createdAt: "2026-06-17T00:00:00.000Z",
			},
		],
		tools: [],
		...overrides,
	};
}

function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.listen(0, () => {
			const addr = srv.address();
			if (addr && typeof addr === "object") {
				const port = addr.port;
				srv.close(() => resolve(port));
			} else {
				srv.close(() => reject(new Error("Could not find free port")));
			}
		});
	});
}

async function sseWaitForEvent(
	baseUrl: string,
	eventType: string,
	action: () => Promise<unknown>,
	timeout = 4000,
): Promise<boolean> {
	const controller = new AbortController();
	const eventReceived: string[] = [];

	const ssePromise = fetch(`${baseUrl}/events`, { signal: controller.signal })
		.then(async (res) => {
			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let buf = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				const lines = buf.split("\n");
				buf = lines.pop() || "";
				for (const line of lines) {
					if (line.startsWith("event: ")) {
						eventReceived.push(line.slice(7).trim());
					}
				}
			}
		})
		.catch(() => {});

	await new Promise((r) => setTimeout(r, 300));

	await action();

	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (eventReceived.includes(eventType)) {
			controller.abort();
			return true;
		}
		await new Promise((r) => setTimeout(r, 30));
	}

	controller.abort();
	return false;
}

type HttpResponse = { status: number; body: unknown };

async function api(method: string, url: string, body?: unknown): Promise<HttpResponse> {
	const opts: RequestInit = { method, headers: {} };
	if (body !== undefined) {
		opts.headers = { "Content-Type": "application/json" };
		opts.body = JSON.stringify(body);
	}
	const res = await fetch(url, opts);
	const text = await res.text();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = text;
	}
	return { status: res.status, body: parsed };
}

function runCLI(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
	const cmd = `npx tsx ${cliEntry} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`;
	try {
		const stdout = execSync(cmd, { cwd, encoding: "utf-8", timeout: 15000, windowsHide: true });
		return { stdout: stdout.toString(), stderr: "", status: 0 };
	} catch (e: unknown) {
		const err = e as {
			stdout?: Buffer | string;
			stderr?: Buffer | string;
			status?: number;
		};
		return {
			stdout: (err.stdout ?? "").toString(),
			stderr: (err.stderr ?? "").toString(),
			status: err.status ?? -1,
		};
	}
}

describe("FlowServer HTTP API integration", () => {
	let tmpDir: string;
	let server: FlowServer;
	let baseUrl: string;
	let port: number;

	beforeAll(async () => {
		tmpDir = join(tmpdir(), `letra-flow-serve-int-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra", "specs", "auth"), { recursive: true });
		writeFileSync(
			join(tmpDir, ".letra", "specs", "auth", "spec.md"),
			["# Spec: Auth", "", "## Outcome", "User authentication flow.", ""].join("\n"),
		);

		const workflow = createTestWorkflow();
		saveWorkflow(tmpDir, workflow);

		port = await findFreePort();
		server = new FlowServer(tmpDir, port);
		await server.start();
		baseUrl = `http://localhost:${port}`;
	});

	afterAll(() => {
		server.stop();
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	describe("AC1.1 — Claim via POST /api/items/:id/claim", () => {
		it("should populate claimedBy and claimedAt on claim", async () => {
			const { status, body } = await api("POST", `${baseUrl}/api/items/ITEM-1/claim`);
			expect(status).toBe(200);
			const item = body as Record<string, unknown>;
			expect(item.claimedBy).toBe("web-ui");
			expect(item.claimedAt).toEqual(expect.any(String));
		});

		it("should return 404 for non-existent item", async () => {
			const { status } = await api("POST", `${baseUrl}/api/items/ITEM-999/claim`);
			expect(status).toBe(404);
		});

		it("should return 400 when claiming a done-zone item", async () => {
			const { status, body } = await api("POST", `${baseUrl}/api/items/ITEM-3/claim`);
			expect(status).toBe(400);
			const err = body as { error?: string };
			expect(err.error).toMatch(/cannot claim a completed/i);
		});
	});

	describe("AC1.2 — Release via POST /api/items/:id/release", () => {
		it("should clear claimedBy and claimedAt", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-1/claim`);

			const { status, body } = await api("POST", `${baseUrl}/api/items/ITEM-1/release`);
			expect(status).toBe(200);
			const item = body as Record<string, unknown>;
			expect(item.claimedBy).toBeUndefined();
			expect(item.claimedAt).toBeUndefined();
		});
	});

	describe("AC1.3 — Focus set via POST /api/items/:id/focus", () => {
		it("should write focus.md with correct itemId", async () => {
			const { status, body } = await api("POST", `${baseUrl}/api/items/ITEM-1/focus`);
			expect(status).toBe(200);
			const res = body as { itemId?: string; spec?: string };
			expect(res.itemId).toBe("ITEM-1");
			expect(res.spec).toBe("auth");

			const focusFile = join(tmpDir, ".letra", "focus.md");
			expect(existsSync(focusFile)).toBe(true);
			const content = readFileSync(focusFile, "utf-8");
			expect(content).toContain("**Item**: ITEM-1");
			expect(content).toContain("# Focus: auth");
		});
	});

	describe("AC1.4 — Focus clear via DELETE /api/focus", () => {
		it("should remove focus.md", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-1/focus`);
			expect(existsSync(join(tmpDir, ".letra", "focus.md"))).toBe(true);

			const { status, body } = await api("DELETE", `${baseUrl}/api/focus`);
			expect(status).toBe(200);
			const res = body as { active?: boolean };
			expect(res.active).toBe(false);
			expect(existsSync(join(tmpDir, ".letra", "focus.md"))).toBe(false);
		});
	});

	describe("GET /api/workflow", () => {
		it("should return the full workflow with item state", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-1/claim`);
			const { status, body } = await api("GET", `${baseUrl}/api/workflow`);
			expect(status).toBe(200);
			const wf = body as { items?: Array<Record<string, unknown>> };
			expect(wf.items).toBeDefined();
			const item = wf.items!.find((i) => i.id === "ITEM-1");
			expect(item).toBeDefined();
			expect(item!.claimedBy).toBe("web-ui");
		});

		it("should reflect release via GET", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-1/claim`);
			await api("POST", `${baseUrl}/api/items/ITEM-1/release`);

			const { body } = await api("GET", `${baseUrl}/api/workflow`);
			const wf = body as { items?: Array<Record<string, unknown>> };
			const item = wf.items!.find((i) => i.id === "ITEM-1");
			expect(item!.claimedBy).toBeUndefined();
		});
	});

	describe("GET /api/system-actions", () => {
		it("should expose recurring server automations with supervision metadata", async () => {
			const { status, body } = await api("GET", `${baseUrl}/api/system-actions`);
			expect(status).toBe(200);
			const data = body as { actions?: Array<Record<string, unknown>> };
			expect(Array.isArray(data.actions)).toBe(true);
			expect(data.actions?.some((action) => action.id === "workflow-watch")).toBe(true);
			expect(data.actions?.some((action) => action.id === "specs-watch")).toBe(true);
			const diagnostics = data.actions?.find((action) => action.id === "diagnostics-scan");
			expect(diagnostics?.cause).toEqual(expect.any(String));
			expect(diagnostics?.effect).toEqual(expect.any(String));
		});
	});

	describe("GET /api/workflow/active-flow", () => {
		it("loads the harness version declared by the workflow", async () => {
			const harnessRoot = join(tmpDir, ".letra", "harness", "v9.9.9");
			mkdirSync(join(harnessRoot, "flows"), { recursive: true });
			mkdirSync(join(harnessRoot, "gates"), { recursive: true });
			mkdirSync(join(harnessRoot, "roles"), { recursive: true });
			writeFileSync(
				join(harnessRoot, "flows", "dynamic.yaml"),
				[
					"id: dynamic",
					"version: 9.9.9",
					"name: Dynamic Flow",
					"description: Dynamically resolved flow",
					"defaultPolicy: default",
					"stages:",
					...createTestWorkflow().stages.flatMap((stage) => [
						`  - id: ${stage.id}`,
						`    name: ${stage.name}`,
						`    order: ${stage.order}`,
						`    zone: ${stage.zone}`,
					]),
				].join("\n"),
			);

			const workflow = createTestWorkflow({
				template: "dynamic",
				harnessVersion: "v9.9.9",
			});
			saveWorkflow(tmpDir, workflow);

			const { status, body } = await api("GET", `${baseUrl}/api/workflow/active-flow`);
			expect(status).toBe(200);
			expect(body).toEqual(expect.objectContaining({
				id: "dynamic",
				source: "workflow-template",
				harnessVersion: "v9.9.9",
				templateVersion: "9.9.9",
			}));

			saveWorkflow(tmpDir, createTestWorkflow());
		});

		it("resolves the harness from the workspace that supplied the workflow", async () => {
			const secondaryRoot = join(tmpDir, "secondary-workspace");
			const harnessRoot = join(secondaryRoot, ".letra", "harness", "v2.0.0");
			mkdirSync(join(harnessRoot, "flows"), { recursive: true });
			mkdirSync(join(harnessRoot, "gates"), { recursive: true });
			mkdirSync(join(harnessRoot, "roles"), { recursive: true });
			writeFileSync(
				join(harnessRoot, "flows", "secondary.yaml"),
				[
					"id: secondary",
					"version: 2.0.0",
					"name: Secondary Workspace Flow",
					"description: Root-safe flow",
					"defaultPolicy: default",
					"stages:",
					"  - id: secondary-stage",
					"    name: Secondary Stage",
					"    order: 0",
					"    zone: doing",
				].join("\n"),
			);
			saveWorkflow(secondaryRoot, createTestWorkflow({
				name: "secondary-workspace",
				template: "secondary",
				harnessVersion: "v2.0.0",
				stages: [{ id: "secondary-stage", name: "Instance Stage", order: 0, zone: "doing" }],
			}));

			const { status, body } = await api(
				"GET",
				`${baseUrl}/api/workflow/active-flow?workspace=${encodeURIComponent(secondaryRoot)}`,
			);

			expect(status).toBe(200);
			expect(body).toEqual(expect.objectContaining({
				id: "secondary",
				name: "Secondary Workspace Flow",
				harnessVersion: "v2.0.0",
			}));

			const update = await api(
				"PATCH",
				`${baseUrl}/api/items/ITEM-1?workspace=${encodeURIComponent(secondaryRoot)}`,
				{ stage: "secondary-stage" },
			);
			expect(update.status).toBe(200);
			const secondaryWorkflow = JSON.parse(
				readFileSync(join(secondaryRoot, ".letra", "workflow.json"), "utf-8"),
			) as Workflow;
			const primaryWorkflow = JSON.parse(
				readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
			) as Workflow;
			expect(secondaryWorkflow.items.find((item) => item.id === "ITEM-1")?.stage).toBe(
				"secondary-stage",
			);
			expect(primaryWorkflow.items.find((item) => item.id === "ITEM-1")?.stage).toBe("code");
		});
	});

	describe("POST /api/workspace/switch", () => {
		it("should expose workspaceRoot while preserving projectRoot compatibility", async () => {
			const { status, body } = await api("POST", `${baseUrl}/api/workspace/switch`, { workspaceRoot: tmpDir });
			expect(status).toBe(200);
			const data = body as { workspaceRoot?: string; projectRoot?: string };
			expect(data.workspaceRoot).toBe(tmpDir);
			expect(data.projectRoot).toBe(tmpDir);
		});
	});

	describe("AC1.8 — SSE broadcast verification", () => {
		it("should broadcast workflow-updated after claim", async () => {
			const received = await sseWaitForEvent(baseUrl, "workflow-updated", async () => {
				await api("POST", `${baseUrl}/api/items/ITEM-2/claim`);
			});
			expect(received).toBe(true);
		});

		it("should broadcast workflow-updated after release", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-2/claim`);
			const received = await sseWaitForEvent(baseUrl, "workflow-updated", async () => {
				await api("POST", `${baseUrl}/api/items/ITEM-2/release`);
			});
			expect(received).toBe(true);
		});

		it("should broadcast workflow-updated after focus set", async () => {
			const received = await sseWaitForEvent(baseUrl, "workflow-updated", async () => {
				await api("POST", `${baseUrl}/api/items/ITEM-1/focus`);
			});
			expect(received).toBe(true);
		});

		it("should broadcast workflow-updated after focus clear", async () => {
			await api("POST", `${baseUrl}/api/items/ITEM-1/focus`);
			const received = await sseWaitForEvent(baseUrl, "workflow-updated", async () => {
				await api("DELETE", `${baseUrl}/api/focus`);
			});
			expect(received).toBe(true);
		});
	});

	describe("GET /api/activity-context", () => {
		it("should return default implement context", async () => {
			const { status, body } = await api("GET", `${baseUrl}/api/activity-context`);
			expect(status).toBe(200);
			const context = body as {
				activity?: string;
				currentItem?: { id?: string };
				mustRead?: Array<{ path: string }>;
			};
			expect(context.activity).toBe("implement");
			expect(context.currentItem?.id).toBe("ITEM-1");
			expect(context.mustRead?.some((entry) => entry.path === ".letra/context.md")).toBe(true);
		});

		it("should return requested activity context", async () => {
			const { status, body } = await api("GET", `${baseUrl}/api/activity-context?activity=review`);
			expect(status).toBe(200);
			const context = body as {
				activity?: string;
				nextActions?: Array<{ label: string }>;
			};
			expect(context.activity).toBe("review");
			expect(context.nextActions?.[0]?.label).toBe("Comparar com spec");
		});
	});
});

describe("CLI integration (AC1.5 — focus)", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = join(tmpdir(), `letra-cli-focus-int-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra", "specs", "auth"), { recursive: true });
		writeFileSync(
			join(tmpDir, ".letra", "specs", "auth", "spec.md"),
			["# Spec: Auth", "", "## Outcome", "User auth.", ""].join("\n"),
		);

		const workflow: Workflow = {
			version: "1.0",
			name: "test",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [{ id: "code", name: "Code", order: 0, zone: "doing" }],
			items: [
				{
					id: "ITEM-1",
					description: "Auth feature",
					stage: "code",
					createdAt: new Date().toISOString(),
					spec: "auth",
				},
			],
			tools: [],
		};
		saveWorkflow(tmpDir, workflow);
	});

	afterAll(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("focus <spec> without --claim leaves claimedBy unchanged", () => {
		runCLI(["focus", "auth"], tmpDir);
		const wf = JSON.parse(
			readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
		);
		expect(wf.items[0].claimedBy).toBeUndefined();
	}, 20000);

	it("focus <spec> --claim populates claimedBy", () => {
		runCLI(["focus", "auth", "--claim"], tmpDir);
		const wf = JSON.parse(
			readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
		);
		expect(wf.items[0].claimedBy).toBe("opencode");
		expect(wf.items[0].claimedAt).toEqual(expect.any(String));
	}, 20000);
});

describe("CLI integration (AC1.6 — flow move syncs focus)", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = join(tmpdir(), `letra-cli-move-int-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra", "specs", "auth"), { recursive: true });
		writeFileSync(
			join(tmpDir, ".letra", "specs", "auth", "spec.md"),
			["# Spec: Auth", "", "## Outcome", "User auth.", ""].join("\n"),
		);

		const workflow: Workflow = {
			version: "1.0",
			name: "test",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [
				{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
				{ id: "code", name: "Code", order: 1, zone: "doing" },
				{ id: "review", name: "Review", order: 2, zone: "doing" },
				{ id: "done", name: "Done", order: 3, zone: "done" },
			],
			items: [
				{
					id: "ITEM-1",
					description: "Auth feature",
					stage: "code",
					createdAt: new Date().toISOString(),
					spec: "auth",
				},
			],
			tools: [],
		};
		saveWorkflow(tmpDir, workflow);
	});

	afterAll(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("flow move ITEM-X --to review syncs focus via focus.md", () => {
		runCLI(["flow", "move", "ITEM-1", "--to", "review"], tmpDir);

		const focusFile = join(tmpDir, ".letra", "focus.md");
		expect(existsSync(focusFile)).toBe(true);

		const content = readFileSync(focusFile, "utf-8");
		expect(content).toContain("**Item**: ITEM-1");
		expect(content).toContain("# Focus: auth");

		const wf = JSON.parse(
			readFileSync(join(tmpDir, ".letra", "workflow.json"), "utf-8"),
		);
		const item = wf.items.find((i: Item) => i.id === "ITEM-1");
		expect(item.stage).toBe("review");
	}, 20000);
});
