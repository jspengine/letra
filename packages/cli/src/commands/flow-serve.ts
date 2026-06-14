import { existsSync, mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";

import { type IncomingMessage, type ServerResponse, createServer } from "node:http";

import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkflow, saveWorkflow, detectProjectName } from "./flow-init.js";
import type { Item, Workflow } from "./flow-init.js";
import { DiagnosticEngine } from "../diagnostics/engine.js";

const DEFAULT_PORT = 3000;

interface ResolvedSpec {
	id: string;
	content: string;
}

function loadSpecs(root: string, workflow: Workflow | null): ResolvedSpec[] {
	const result: ResolvedSpec[] = [];

	// First: load from specLinks (workflow.json registration)
	if (workflow?.specLinks) {
		for (const [id, link] of Object.entries(workflow.specLinks)) {
			const filePath = join(root, link.path);
			if (existsSync(filePath)) {
				result.push({ id, content: readFileSync(filePath, "utf-8") });
			}
		}
	}

	// Fallback: scan .letra/specs/ for unregistered specs
	const specsDir = join(root, ".letra", "specs");
	const registered = new Set(result.map((s) => s.id));
	if (existsSync(specsDir)) {
		for (const entry of readdirSync(specsDir, { withFileTypes: true })) {
			if (entry.isDirectory() && !registered.has(entry.name)) {
				const specPath = join(specsDir, entry.name, "spec.md");
				if (existsSync(specPath)) {
					result.push({ id: entry.name, content: readFileSync(specPath, "utf-8") });
				}
			}
		}
	}

	return result;
}
function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

interface TemplateStage {
	id: string;
	name: string;
	zone?: "todo" | "doing" | "done";
}

const TEMPLATES: Record<string, { name: string; stages: TemplateStage[] }> = {
	padrao: {
		name: "Padrão",
		stages: [
			{ id: "backlog", name: "Backlog", zone: "todo" },
			{ id: "design", name: "Design", zone: "doing" },
			{ id: "code", name: "Code", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
	kanban: {
		name: "Kanban",
		stages: [
			{ id: "todo", name: "A Fazer", zone: "todo" },
			{ id: "doing", name: "Fazendo", zone: "doing" },
			{ id: "done", name: "Feito", zone: "done" },
		],
	},
	agil: {
		name: "Ágil",
		stages: [
			{ id: "product-backlog", name: "Product Backlog", zone: "todo" },
			{ id: "sprint-backlog", name: "Sprint Backlog", zone: "todo" },
			{ id: "in-progress", name: "In Progress", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
};

function createWorkflowFromTemplate(
	root: string,
	templateId: string,
	options?: { name?: string; tools?: string[] },
): Workflow {
	const t = TEMPLATES[templateId];
	if (!t) {
		throw new Error(
			`Template "${templateId}" not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
		);
	}
	const stages = t.stages.map((s, i) => ({
		id: s.id,
		name: s.name,
		order: i,
		zone: s.zone,
	}));

	// Merge with existing workflow to preserve items, specLinks, tools
	const existing = loadWorkflow(root);
	return {
		version: "1.0",
		name: options?.name ?? detectProjectName(root) ?? t.name,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		stages,
		items: existing?.items ?? [],
		specLinks: existing?.specLinks ?? undefined,
		tools: options?.tools ?? existing?.tools ?? [],
	};
}

export class FlowServer {
	private server: ReturnType<typeof createServer> | undefined;
	private watcher: ReturnType<typeof watch> | undefined;
	private diagnosticsTimer: ReturnType<typeof setInterval> | undefined;
	private clients: Set<ServerResponse> = new Set();
	private root: string;
	private port: number;
	private loadWorkflow;
	private engine: DiagnosticEngine;

	constructor(root: string, port: number = DEFAULT_PORT) {
		this.root = root;
		this.port = port;
		this.loadWorkflow = () => loadWorkflow(root);
		this.engine = new DiagnosticEngine(root);
	}

	private handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
		const path = url.pathname;

		if (path === "/events") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write("event: connected\ndata: {}\n\n");
			this.clients.add(res);
			req.on("close", () => this.clients.delete(res));
			return;
		}

		if (path === "/api/workflow") {
			const wf = this.loadWorkflow();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(wf ?? { error: "No workflow found" }));
			return;
		}

		if (path === "/api/workflow/template" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const data = JSON.parse(body);
					let wf: Workflow;
					if (data.stages) {
						const stages = data.stages.map(
							(s: { id: string; name: string; zone?: string }, i: number) => ({
								id: s.id,
								name: s.name,
								order: i,
								zone: s.zone,
							}),
						);
						const existing = loadWorkflow(this.root);
						wf = {
							version: "1.0",
							name: data.name ?? detectProjectName(this.root) ?? "Personalizado",
							createdAt: existing?.createdAt ?? new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							stages,
							items: existing?.items ?? [],
							specLinks: existing?.specLinks ?? undefined,
							tools: data.tools ?? existing?.tools ?? [],
						};
					} else {
						wf = createWorkflowFromTemplate(this.root, data.template, {
							name: data.name,
							tools: data.tools,
						});
					}
					saveWorkflow(this.root, wf);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(wf));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path === "/api/specs" && req.method === "GET") {
			try {
				const wf = this.loadWorkflow();
				const specs = loadSpecs(this.root, wf);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(specs));
			} catch {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify([]));
			}
			return;
		}

		if (path === "/api/specs" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const { id, content } = JSON.parse(body);
					if (!id || !content) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "id and content required" }));
						return;
					}
					const specDir = join(this.root, ".letra", "specs", id);
					if (!existsSync(specDir)) mkdirSync(specDir, { recursive: true });
					writeFileSync(join(specDir, "spec.md"), content, "utf-8");
					const wf = this.loadWorkflow();
					if (wf) {
						if (!wf.specLinks) wf.specLinks = {};
						wf.specLinks[id] = { path: `.letra/specs/${id}/spec.md` };
						wf.updatedAt = new Date().toISOString();
						saveWorkflow(this.root, wf);
						this.broadcast();
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ id, content }));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path.startsWith("/api/specs/") && req.method === "DELETE") {
			const specId = path.replace("/api/specs/", "").split("/")[0];
			if (!specId) {
				res.writeHead(400);
				res.end(JSON.stringify({ error: "spec id required" }));
				return;
			}
			const specDir = join(this.root, ".letra", "specs", specId);
			if (existsSync(specDir)) {
				writeFileSync(join(specDir, "spec.md"), "", "utf-8");
			}
			const wf = this.loadWorkflow();
			if (wf?.specLinks) {
				delete wf.specLinks[specId];
				wf.updatedAt = new Date().toISOString();
				saveWorkflow(this.root, wf);
				this.broadcast();
			}
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ deleted: specId }));
			return;
		}

		if (path.startsWith("/api/specs/") && req.method === "PUT") {
			const specId = path.replace("/api/specs/", "").split("/")[0];
			if (!specId) {
				res.writeHead(400);
				res.end(JSON.stringify({ error: "spec id required" }));
				return;
			}
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const { content } = JSON.parse(body);
					if (content === undefined) {
						res.writeHead(400);
						res.end(JSON.stringify({ error: "content required" }));
						return;
					}
					const specDir = join(this.root, ".letra", "specs", specId);
					if (!existsSync(specDir)) mkdirSync(specDir, { recursive: true });
					writeFileSync(join(specDir, "spec.md"), content, "utf-8");
					const wf = this.loadWorkflow();
					if (wf) {
						wf.updatedAt = new Date().toISOString();
						saveWorkflow(this.root, wf);
						this.broadcast();
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ id: specId, content }));
				} catch (e) {
					res.writeHead(400);
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path.match(/^\/api\/specs\/[^/]+\/validate$/) && req.method === "POST") {
			const specId = path.replace("/api/specs/", "").split("/")[0];
			const specDir = join(this.root, ".letra", "specs", specId);
			const specFile = join(specDir, "spec.md");
			const issues: Array<{ type: "error" | "warning"; msg: string }> = [];

			if (!existsSync(specFile)) {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						id: specId,
						issues: [{ type: "error", msg: "spec.md not found" }],
						valid: false,
					}),
				);
				return;
			}

			const content = readFileSync(specFile, "utf-8");

			const requiredSections = [
				"Outcome",
				"Constraints",
				"Exclusions",
				"Acceptance Criteria",
				"Context",
			];
			for (const section of requiredSections) {
				const re = new RegExp(`## ${section}`);
				if (!re.test(content)) {
					issues.push({ type: "error", msg: `Missing section: ## ${section}` });
				}
			}

			const acMatch = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |$)/);
			if (acMatch) {
				const acSection = acMatch[1];
				const items = [...acSection.matchAll(/-\s+\[(\s|x)\]\s+/g)];
				if (items.length === 0) {
					issues.push({
						type: "warning",
						msg: "Acceptance Criteria section has no checklist items",
					});
				}
			}

			if (content.length > 3000) {
				issues.push({ type: "warning", msg: "Spec exceeds 3000 chars (should be thin)" });
			}

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					id: specId,
					issues,
					valid: issues.filter((i) => i.type === "error").length === 0,
				}),
			);
			return;
		}

		// ── Item CRUD ──────────────────────────────────────────────
		if (path === "/api/items" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const { id, description, stage } = JSON.parse(body);
					if (!id || !description || !stage) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "id, description, and stage required" }));
						return;
					}
					const wf = this.loadWorkflow();
					if (!wf) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "No workflow" }));
						return;
					}
					const item: Item = {
						id,
						description,
						stage,
						createdAt: new Date().toISOString(),
						tasks: [],
					};
					wf.items.push(item);
					wf.updatedAt = new Date().toISOString();
					saveWorkflow(this.root, wf);
					this.broadcast();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(item));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path.match(/^\/api\/items\/[^/]+$/) && req.method === "PATCH") {
			const itemId = path.replace("/api/items/", "");
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const data = JSON.parse(body);
					const wf = this.loadWorkflow();
					if (!wf) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "No workflow" }));
						return;
					}
					const item = wf.items.find((i) => i.id === itemId);
					if (!item) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Item not found" }));
						return;
					}
					const oldStage = item.stage;
					if (data.stage !== undefined) item.stage = data.stage;
					if (data.description !== undefined) item.description = data.description;
					if (data.tasks !== undefined) item.tasks = data.tasks;
					wf.updatedAt = new Date().toISOString();
					saveWorkflow(this.root, wf);
					this.broadcast();
					if (data.stage !== undefined && data.stage !== oldStage) {
						this.fireWebhooks("item.moved", {
							itemId: item.id,
							itemDescription: item.description,
							sourceStage: oldStage,
							targetStage: data.stage,
						});
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(item));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path.match(/^\/api\/items\/[^/]+$/) && req.method === "DELETE") {
			const itemId = path.replace("/api/items/", "");
			const wf = this.loadWorkflow();
			if (!wf) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "No workflow" }));
				return;
			}
			const idx = wf.items.findIndex((i) => i.id === itemId);
			if (idx === -1) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Item not found" }));
				return;
			}
			wf.items.splice(idx, 1);
			wf.updatedAt = new Date().toISOString();
			saveWorkflow(this.root, wf);
			this.broadcast();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ deleted: itemId }));
			return;
		}

		// ── Workflow PATCH (update stages, name, etc.) ─────────────
		if (path === "/api/workflow" && req.method === "PATCH") {
			let body = "";
			req.on("data", (chunk: string) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					const data = JSON.parse(body);
					const wf = this.loadWorkflow();
					if (!wf) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "No workflow" }));
						return;
					}
					if (data.stages !== undefined) wf.stages = data.stages;
					if (data.name !== undefined) wf.name = data.name;
					if (data.description !== undefined) wf.description = data.description;
					wf.updatedAt = new Date().toISOString();
					saveWorkflow(this.root, wf);
					this.broadcast();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(wf));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		// ── Legacy /api/move (redirect) ────────────────────────────
		if (path === "/api/move") {
			const itemId = url.searchParams.get("item");
			const stage = url.searchParams.get("stage");
			if (itemId && stage) {
				const wf = this.loadWorkflow();
				if (wf) {
					const item = wf.items.find((i) => i.id === itemId);
					if (item) {
						item.stage = stage;
						wf.updatedAt = new Date().toISOString();
						saveWorkflow(this.root, wf);
						this.broadcast();
					}
				}
			}
			res.writeHead(302, { Location: "/" });
			res.end();
			return;
		}

		if (path === "/api/focus") {
			const focusFile = join(this.root, ".letra", "focus.md");
			if (existsSync(focusFile)) {
				const content = readFileSync(focusFile, "utf-8");
				res.writeHead(200, { "Content-Type": "application/json" });
				const lines = content.split("\n").filter((l) => l.trim());
				res.end(
					JSON.stringify({
						active: true,
						spec: lines[0]?.replace(/^#\s*/, "") || "",
						content,
					}),
				);
			} else {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ active: false }));
			}
			return;
		}

		if (path === "/api/context") {
			const file = url.searchParams.get("file") || "context.md";
			const letraDir = join(this.root, ".letra");
			const allowedFiles = ["context.md", "constitution.md", "glossary.md"];

			if (file === "decisions") {
				const decisionsDir = join(letraDir, "decisions");
				const files: Array<{ name: string; content: string }> = [];
				if (existsSync(decisionsDir)) {
					const names = readdirSync(decisionsDir).filter((f) => f.endsWith(".md"));
					for (const name of names.sort().reverse()) {
						const content = readFileSync(join(decisionsDir, name), "utf-8");
						files.push({ name, content });
					}
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(files));
				return;
			}

			if (!allowedFiles.includes(file)) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: `Invalid file: ${file}` }));
				return;
			}

			const filePath = join(letraDir, file);
			if (!existsSync(filePath)) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: `File not found: ${file}` }));
				return;
			}

			const content = readFileSync(filePath, "utf-8");
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end(content);
			return;
		}

		// ── Diagnostics ──────────────────────────────────────────────
		if (path === "/api/diagnostics" && req.method === "GET") {
			const output = this.engine.getLastOutput();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(output));
			return;
		}

		if (path === "/api/diagnostics/snapshots" && req.method === "GET") {
			const snapshots = this.engine.listSnapshots();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ snapshots }));
			return;
		}

		if (path === "/api/diagnostics/scan" && req.method === "POST") {
			this.engine
				.runAll()
				.then((output) => {
					this.broadcastDiagnostics(output);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(output));
				})
				.catch((e) => {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: e.message }));
				});
			return;
		}

		if (path.match(/^\/api\/diagnostics\/undo\/[^/]+$/) && req.method === "POST") {
			const snapshotId = path.replace("/api/diagnostics/undo/", "");
			this.engine
				.undo(snapshotId)
				.then((result) => {
					if (!result.ok) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Snapshot not found" }));
						return;
					}
					this.broadcast();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(result));
				})
				.catch((e) => {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: e.message }));
				});
			return;
		}

		// Serve SPA (client/dist/) or proxy to Vite dev server
		this.serveClient(path, req, res);
	};

	private clientDir: string | null = null;

	private serveClient(path: string, req: IncomingMessage, res: ServerResponse): void {
		if (!this.clientDir) {
			const cliDir = dirname(fileURLToPath(import.meta.url));
			// Published package via npm: dist/client/ is built alongside CLI
			const builtIn = join(cliDir, "client");
			// Monorepo dev: client/dist/ is in packages/client/
			const monorepoDev = join(this.root, "packages", "client", "dist");
			const candidates = [builtIn, monorepoDev];
			for (const dir of candidates) {
				const idx = join(dir, "index.html");
				if (existsSync(idx)) {
					this.clientDir = dir;
					break;
				}
			}
		}

		// Dev mode: proxy to Vite dev server
		if (!this.clientDir) {
			this.proxyToVite(req, res);
			return;
		}

		// Serve static files
		let filePath = join(this.clientDir, path === "/" ? "index.html" : path);
		if (!existsSync(filePath)) {
			filePath = join(this.clientDir, "index.html");
		}
		const ext = extname(filePath);
		const mime: Record<string, string> = {
			".html": "text/html; charset=utf-8",
			".js": "application/javascript; charset=utf-8",
			".css": "text/css; charset=utf-8",
			".svg": "image/svg+xml",
			".png": "image/png",
			".ico": "image/x-icon",
			".json": "application/json",
		};
		const contentType = mime[ext] ?? "application/octet-stream";
		res.writeHead(200, { "Content-Type": contentType });
		res.end(readFileSync(filePath));
	}

	private proxyToVite(req: IncomingMessage, res: ServerResponse): void {
		const proxyUrl = `http://localhost:5173${req.url}`;
		fetch(proxyUrl)
			.then((proxyRes) => {
				res.writeHead(proxyRes.status, Object.fromEntries(proxyRes.headers));
				proxyRes.body?.pipeTo(
					new WritableStream({
						write(chunk) {
							res.write(chunk);
						},
						close() {
							res.end();
						},
					}),
				);
			})
			.catch(() => {
				res.writeHead(502, { "Content-Type": "text/plain" });
				res.end("Vite dev server not running on http://localhost:5173");
			});
	}

	private broadcast(): void {
		if (this.clients.size === 0) return;
		const data = "event: workflow-updated\ndata: {}\n\n";
		for (const client of this.clients) {
			try {
				client.write(data);
			} catch {
				this.clients.delete(client);
			}
		}
	}

	private broadcastDiagnostics(output: {
		fixes: unknown[];
		suggestions: unknown[];
		errors: unknown[];
	}): void {
		if (this.clients.size === 0) return;
		const data = `event: diagnostics-updated\ndata: ${JSON.stringify({ fixes: output.fixes.length, suggestions: output.suggestions.length, errors: output.errors.length })}\n\n`;
		for (const client of this.clients) {
			try {
				client.write(data);
			} catch {
				this.clients.delete(client);
			}
		}
	}

	private async fireWebhooks(event: string, payload: Record<string, unknown>): Promise<void> {
		const wf = this.loadWorkflow();
		if (!wf?.webhooks || wf.webhooks.length === 0) return;
		const matching = wf.webhooks.filter((wh) => wh.events.includes(event));
		if (matching.length === 0) return;
		const body = JSON.stringify({
			event,
			workflow: wf.name,
			timestamp: new Date().toISOString(),
			...payload,
		});
		for (const wh of matching) {
			try {
				const res = await fetch(wh.url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
				});
				wh.lastStatus = res.ok ? "ok" : "error";
			} catch {
				wh.lastStatus = "error";
			}
			wh.lastSentAt = new Date().toISOString();
		}
		saveWorkflow(this.root, wf);
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server = createServer(this.handleRequest);
			this.server.listen(this.port, () => {
				const wfPath = join(this.root, ".letra", "workflow.json");
				if (existsSync(wfPath)) {
					try {
						this.watcher = watch(wfPath, () => this.broadcast());
					} catch {}
				}

				// First diagnostic scan immediately after starting
				this.engine.ensureDirs();
				this.engine
					.runAll()
					.then((output) => {
						this.broadcastDiagnostics(output);
					})
					.catch(() => {
						/* silent */
					});

				// Periodic diagnostic scan every 30s
				this.diagnosticsTimer = setInterval(() => {
					this.engine
						.runAll()
						.then((output) => {
							this.broadcastDiagnostics(output);
						})
						.catch(() => {
							/* silent */
						});
				}, 30000);

				resolve();
			});
			this.server.on("error", reject);
		});
	}

	stop(): void {
		if (this.watcher) this.watcher.close();
		if (this.diagnosticsTimer) clearInterval(this.diagnosticsTimer);
		if (this.server) this.server.close();
		for (const client of this.clients) {
			client.destroy();
		}
		this.clients.clear();
	}

	getPort(): number {
		return this.port;
	}
}

export async function flowServeAction(
	targetPath: string | undefined,
	options?: { port?: number; open?: boolean },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath ?? ".");
	const port = options?.port ?? DEFAULT_PORT;

	const wf = loadWorkflow(root);
	if (!wf) {
		console.log("No workflow found. Run 'letra flow init --quick' first");
		return;
	}

	const server = new FlowServer(root, port);
	try {
		await server.start();
		console.log(`\n  Flow Board → http://localhost:${port}\n`);
		console.log("  Press Ctrl+C to stop\n");

		if (options?.open) {
			const { execSync } = await import("node:child_process");
			const cmd =
				process.platform === "win32"
					? "start"
					: process.platform === "darwin"
						? "open"
						: "xdg-open";
			try {
				execSync(`${cmd} http://localhost:${port}`, { stdio: "ignore" });
			} catch {}
		}

		await new Promise<void>((resolve) => {
			process.on("SIGINT", () => {
				server.stop();
				resolve();
			});
		});
	} catch (err) {
		console.error(`Failed to start server on port ${port}:`, (err as Error).message);
		process.exit(1);
	}
}
