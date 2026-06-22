import { existsSync, mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";

import { type IncomingMessage, type ServerResponse, createServer } from "node:http";

import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkflow, writeWorkflow, detectProjectName } from "./flow-init.js";
import type { Item, Workflow } from "./flow-init.js";
import { loadHarness, resolveHarnessRoot } from "../harness/loader";
import type { FlowTemplate, HarnessManifest } from "../harness/types";
import { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticResult } from "../diagnostics/types.js";
import { validateSpecStructure } from "../validation/structure.js";
import {
	loadHealthRecord,
	saveHealthRecord,
	mergeScanResults,
	ackEntry,
	dismissEntry,
	getSummary,
	getActiveEntries,
} from "../health-record.js";
import { logEntry, queryLog } from "../session-log.js";
import { clearFocusFile, writeFocusFile } from "../adapters/focus-sync.js";
import { pulse } from "./pulse.js";
import { sitrep } from "./sitrep.js";

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
	harness?: HarnessManifest | null,
): Workflow {
	const t = harness?.flows?.[templateId]
		? {
				name: harness.flows[templateId].name,
				stages: harness.flows[templateId].stages.map((s) => ({
					id: s.id,
					name: s.name,
					order: s.order,
					zone: s.zone,
				})),
		  }
		: TEMPLATES[templateId];
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
		language: existing?.language,
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
	private specsWatcher: ReturnType<typeof watch> | undefined;
	private diagnosticsTimer: ReturnType<typeof setInterval> | undefined;
	private clients: Set<ServerResponse> = new Set();
	private root: string;
	private port: number;
	private loadWorkflow;
	private engine: DiagnosticEngine;
	private harness: HarnessManifest | null;

	constructor(root: string, port: number = DEFAULT_PORT) {
		this.root = root;
		this.port = port;
		this.loadWorkflow = () => loadWorkflow(root);
		this.engine = new DiagnosticEngine(root);
		const harnessRoot = resolveHarnessRoot(root);
		this.harness = loadHarness(harnessRoot);
	}

	private handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
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
							language: existing?.language,
							createdAt: existing?.createdAt ?? new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							stages,
							items: existing?.items ?? [],
							specLinks: existing?.specLinks ?? undefined,
							tools: data.tools ?? existing?.tools ?? [],
						};
					} else {
						const existing = loadWorkflow(this.root);
						wf = createWorkflowFromTemplate(this.root, data.template, {
							name: data.name,
							tools: data.tools,
						}, this.harness);
						if (existing?.language && wf) {
							wf.language = existing.language;
						}
					}
					writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
					// BROADCAST: workflow created/updated from template
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

		if (path === "/api/harness/templates" && req.method === "GET") {
			const templates = this.harness
				? Object.values(this.harness.flows).map((f) => {
						const gateIds = new Set(
							f.stages
								.map((s) => s.gate)
								.filter((g): g is string => !!g)
								.map((g) => {
									// suporta tanto id puro quanto caminho relativo "gates/id.yaml"
									const base = g.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");
									return base;
								}),
						);
						const gates = gateIds.size
							? [...gateIds]
								.map((id) => this.harness?.gates?.[id])
								.filter((g): g is NonNullable<typeof g> => !!g)
							: [];

						const roleIds = new Set(
							f.stages.flatMap((s) => (Array.isArray(s.agents) ? s.agents : [])),
						);
						const roles = roleIds.size
							? [...roleIds]
								.map((id) => this.harness?.roles?.[id])
								.filter((r): r is NonNullable<typeof r> => !!r)
							: [];

						const policyRefs = new Set<string>();
						for (const g of gates) {
							if (g.policyRef) policyRefs.add(g.policyRef.replace(/^.*[\\/]/, "").replace(/\.json$/, ""));
						}
						const policies = [...policyRefs]
							.map((ref) => this.harness?.policies?.[ref])
							.filter((p): p is NonNullable<typeof p> => !!p);

						return {
							id: f.id,
							version: f.version,
							name: f.name,
							description: f.description,
							stages: f.stages,
							gates,
							roles,
							policies,
						};
					})
				: [];
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(templates));
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
					writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
					// BROADCAST: spec created
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
				writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
				// BROADCAST: spec deleted
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
					writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
					// BROADCAST: spec updated
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
			const { errors: structErrors, warnings: structWarnings } = validateSpecStructure(specFile);
			for (const e of structErrors) issues.push({ type: "error", msg: e });
			for (const w of structWarnings) issues.push({ type: "warning", msg: w });

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
				writeWorkflow(this.root, { workflow: wf, source: "web-ui", primaryItemId: item.id, skipSitrep: true, quiet: true });
				// BROADCAST: item created
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

		if (path.match(/^\/api\/items\/[^/]+$/) && req.method === "GET") {
			const itemId = path.replace("/api/items/", "");
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
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(item));
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
					if (data.stage !== undefined && data.stage !== oldStage) {
						// Gate enforcement via harness
						const template = this.harness?.flows?.sdlc;
						console.log("[PATCH] stage change", itemId, oldStage, "->", data.stage, "has_harness:", !!this.harness, "has_template:", !!template);
						if (template) {
							const targetStage = template.stages.find((s: { id?: string }) => s.id === data.stage);
							console.log("[PATCH] targetStage gate:", targetStage?.gate);
							if (targetStage?.gate) {
								const gateId = targetStage.gate.replace(/^.*[\\/]/, "").replace(/\.yaml$/, "");
								const gate = this.harness?.gates?.[gateId];
								console.log("[PATCH] gateId:", gateId, "gate:", gate);
								if (gate && gate.type === "human") {
									res.writeHead(422, { "Content-Type": "application/json" });
									res.end(JSON.stringify({ error: `Gate bloqueante: ${gate.name}. Aprovação humana necessária para entrar em "${targetStage.name}".` }));
									return;
								}
							}
						}
						item.stage = data.stage;
					}
					if (data.description !== undefined) item.description = data.description;
					if (data.tasks !== undefined) item.tasks = data.tasks;
				wf.updatedAt = new Date().toISOString();
				writeWorkflow(this.root, { workflow: wf, source: "web-ui", primaryItemId: itemId, skipSitrep: true, quiet: true });
				// BROADCAST: item updated
				this.broadcast();
				if (data.stage !== undefined && data.stage !== oldStage) {
						if (item.spec) {
							writeFocusFile(this.root, item.spec, item.id);
							logEntry(this.root, "focus_sync", `Focus synced to ${item.spec} via item move (${item.id})`, { itemId: item.id, spec: item.spec });
							console.log(`  [focus] Synced to ${item.spec} via drag`);
						}
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
			writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
			// BROADCAST: item deleted
			this.broadcast();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ deleted: itemId }));
			return;
		}

		// ── Item Claim / Release ──────────────────────────────────
		if (path.match(/^\/api\/items\/[^/]+\/claim$/) && req.method === "POST") {
			const itemId = path.replace("/api/items/", "").replace("/claim", "");
			const wf = this.loadWorkflow();
			if (!wf) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "No workflow" }));
				return;
			}
			const item = wf.items.find((i: Item) => i.id === itemId);
			if (!item) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Item not found" }));
				return;
			}
			const doneZones = new Set(wf.stages.filter((s) => s.zone === "done").map((s) => s.id));
			if (doneZones.has(item.stage)) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Cannot claim a completed item" }));
				return;
			}
			item.claimedBy = "web-ui";
			item.claimedAt = new Date().toISOString();
			wf.updatedAt = new Date().toISOString();
			writeWorkflow(this.root, { workflow: wf, source: "web-ui", primaryItemId: item.id, skipSitrep: true, quiet: true });
			// BROADCAST: item claimed
			this.broadcast();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(item));
			return;
		}

		if (path.match(/^\/api\/items\/[^/]+\/release$/) && req.method === "POST") {
			const itemId = path.replace("/api/items/", "").replace("/release", "");
			const wf = this.loadWorkflow();
			if (!wf) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "No workflow" }));
				return;
			}
			const item = wf.items.find((i: Item) => i.id === itemId);
			if (!item) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Item not found" }));
				return;
			}
			delete item.claimedBy;
			delete item.claimedAt;
			wf.updatedAt = new Date().toISOString();
			writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
			// BROADCAST: item released
			this.broadcast();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(item));
			return;
		}

		// ── Item Focus (set/clear via UI) ──────────────────────────
		if (path.match(/^\/api\/items\/[^/]+\/focus$/) && req.method === "POST") {
			const itemId = path.replace("/api/items/", "").replace("/focus", "");
			const wf = this.loadWorkflow();
			if (!wf) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "No workflow" }));
				return;
			}
			const item = wf.items.find((i: Item) => i.id === itemId);
			if (!item) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Item not found" }));
				return;
			}
			const specName = item.spec || itemId;
			writeFocusFile(this.root, specName, item.id);
			logEntry(this.root, "focus_set", `Focus set via UI: ${specName}`, { itemId });
			// BROADCAST: item focus set
			this.broadcast();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ itemId, spec: specName }));
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
				writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipSitrep: true, quiet: true });
				// BROADCAST: workflow config updated
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
						writeWorkflow(this.root, { workflow: wf, source: "web-ui", primaryItemId: itemId, skipSitrep: true, quiet: true });
						// BROADCAST: item moved via legacy endpoint
						this.broadcast();
					}
				}
			}
			res.writeHead(302, { Location: "/" });
			res.end();
			return;
		}

		if (path === "/api/focus") {
			if (req.method === "DELETE") {
				clearFocusFile(this.root);
				logEntry(this.root, "focus_clear", "Focus cleared via UI");
				// BROADCAST: focus cleared
				this.broadcast();
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ active: false }));
				return;
			}
			if (req.method === "POST") {
				let body = "";
				req.on("data", (chunk: string) => { body += chunk; });
				req.on("end", () => {
					try {
						const data = JSON.parse(body);
						const specName = data.spec || "unknown";
						const itemId = data.itemId || "";
						writeFocusFile(this.root, specName, itemId);
						logEntry(this.root, "focus_set", `Focus set via UI: ${specName}`, { itemId });
						// BROADCAST: focus set via POST
						this.broadcast();
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ active: true, spec: specName, itemId }));
					} catch (e) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: (e as Error).message }));
					}
				});
				return;
			}
			// GET
			const focusFile = join(this.root, ".letra", "focus.md");
			if (existsSync(focusFile)) {
				const content = readFileSync(focusFile, "utf-8");
				res.writeHead(200, { "Content-Type": "application/json" });
				const lines = content.split("\n").filter((l) => l.trim());
				const itemMatch = content.match(/\*\*Item\*\*:\s*(.+)/);
				res.end(
					JSON.stringify({
						active: true,
						spec: lines[0]?.replace(/^#\s*/, "") || "",
						itemId: itemMatch ? itemMatch[1].trim() : null,
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
			let snapshots = this.engine.listSnapshots();
			const total = snapshots.length;
			const limitParam = url.searchParams.get("limit");
			const offsetParam = url.searchParams.get("offset");
			if (limitParam !== null || offsetParam !== null) {
				const limit = limitParam ? parseInt(limitParam, 10) : total;
				const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
				snapshots = snapshots.slice(offset, offset + limit);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ snapshots, total, limit, offset }));
			} else {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ snapshots }));
			}
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
					// BROADCAST: diagnostic undo
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

		if (path.match(/^\/api\/diagnostics\/redo\/[^/]+$/) && req.method === "POST") {
			const snapshotId = path.replace("/api/diagnostics/redo/", "");
			this.engine
				.redo(snapshotId)
				.then((result) => {
					if (!result.ok) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Snapshot not found" }));
						return;
					}
					// BROADCAST: diagnostic redo
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

		// ── Health Record API ─────────────────────────────────────────
		if (path === "/api/health" && req.method === "GET") {
			const record = loadHealthRecord(this.root);
			const summary = getSummary(record);
			const active = getActiveEntries(record);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ summary, entries: record.entries, active }));
			return;
		}

		if (path === "/api/health/alerts" && req.method === "GET") {
			const record = loadHealthRecord(this.root);
			const alerts = record.entries.filter((e) => e.status === "novo");
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(alerts));
			return;
		}

		if (path === "/api/health/scan" && req.method === "POST") {
			this.engine
				.runAll()
				.then((output) => {
					const suggestions: DiagnosticResult[] = output.suggestions.map((s) => ({
						id: s.id,
						type: s.type,
						title: s.title,
						description: s.description,
						certainty: 0.8,
						detector: s.detector,
					}));
					const record = loadHealthRecord(this.root);
					mergeScanResults(record, suggestions);
					saveHealthRecord(this.root, record);
					this.broadcastDiagnostics(output);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ fixes: output.fixes.length, suggestions: output.suggestions.length }));
				})
				.catch((e) => {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: e.message }));
				});
			return;
		}

		if (path === "/api/health/ack" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk: string) => { body += chunk; });
			req.on("end", () => {
				try {
					const { id } = JSON.parse(body);
					const record = loadHealthRecord(this.root);
					if (ackEntry(record, id)) {
						saveHealthRecord(this.root, record);
						// BROADCAST: health entry acknowledged
						this.broadcast();
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ acked: id }));
					} else {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Entry not found" }));
					}
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		if (path === "/api/health/dismiss" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk: string) => { body += chunk; });
			req.on("end", () => {
				try {
					const { id, reason } = JSON.parse(body);
					const record = loadHealthRecord(this.root);
					if (dismissEntry(record, id, reason)) {
						saveHealthRecord(this.root, record);
						// BROADCAST: health entry dismissed
						this.broadcast();
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ dismissed: id }));
					} else {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Entry not found" }));
					}
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: (e as Error).message }));
				}
			});
			return;
		}

		// ── Item Alerts API (AC10) ──────────────────────────────────────
		if (path === "/api/items/alerts" && req.method === "GET") {
			const record = loadHealthRecord(this.root);
			const itemAlerts: Record<string, number> = {};
			for (const entry of record.entries) {
				if (entry.status !== "novo") continue;
				const match = entry.id.match(/_([A-Z]+-\d+)_/);
				if (match) {
					const itemId = match[1];
					itemAlerts[itemId] = (itemAlerts[itemId] || 0) + 1;
				}
			}
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ itemAlerts }));
			return;
		}

		// ── Session Log API ──────────────────────────────────────────
		if (path === "/api/log" && req.method === "GET") {
			const itemId = url.searchParams.get("item") ?? undefined;
			const action = url.searchParams.get("action") ?? undefined;
			const since = url.searchParams.get("since") ?? undefined;
			const all = url.searchParams.get("all") === "true";
			const limitParam = url.searchParams.get("limit");
			const entries = queryLog(this.root, {
				all,
				itemId,
				action,
				since,
				limit: limitParam ? parseInt(limitParam, 10) : 50,
			});
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ entries }));
			return;
		}

		// ── Sitrep API ────────────────────────────────────────────────
		if (path === "/api/sitrep" && req.method === "POST") {
			const dryRun = url.searchParams.get("dryRun") === "true";
			await sitrep(this.root, { dryRun });
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
			return;
		}

		// ── Workspace Pulse API ───────────────────────────────────────
		if (path === "/api/pulse" && req.method === "GET") {
			const data = await pulse(this.root, { json: false });
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
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
		writeWorkflow(this.root, { workflow: wf, source: "web-ui", skipAdapters: true, skipSitrep: true, skipLog: true, quiet: true });
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

				const specsDir = join(this.root, ".letra", "specs");
				if (existsSync(specsDir)) {
					try {
						this.specsWatcher = watch(specsDir, { recursive: true }, () => this.broadcast());
					} catch {}
				}

				// First diagnostic scan immediately after starting
				this.engine.ensureDirs();
				this.engine
					.runAll()
					.then((output) => {
						this.broadcastDiagnostics(output);
						const suggestions: DiagnosticResult[] = output.suggestions.map((s) => ({
							id: s.id,
							type: s.type,
							title: s.title,
							description: s.description,
							certainty: 0.8,
							detector: s.detector,
						}));
						const record = loadHealthRecord(this.root);
						mergeScanResults(record, suggestions);
						saveHealthRecord(this.root, record);
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
							const suggestions: DiagnosticResult[] = output.suggestions.map((s) => ({
								id: s.id,
								type: s.type,
								title: s.title,
								description: s.description,
								certainty: 0.8,
								detector: s.detector,
							}));
							const record = loadHealthRecord(this.root);
							mergeScanResults(record, suggestions);
							saveHealthRecord(this.root, record);
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
		if (this.specsWatcher) this.specsWatcher.close();
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
