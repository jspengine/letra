import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
	watch,
} from "node:fs";
import {
	type IncomingMessage,
	type ServerResponse,
	createServer,
} from "node:http";
import { join, resolve } from "node:path";
import { loadWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";

const DEFAULT_PORT = 3000;

interface SpecInfo {
	name: string;
	content: string;
}

function loadSpecs(root: string): SpecInfo[] {
	const specsDir = join(root, ".letra", "specs");
	if (!existsSync(specsDir)) return [];
	return readdirSync(specsDir)
		.filter((entry) => {
			const specFile = join(specsDir, entry, "spec.md");
			return (
				statSync(join(specsDir, entry)).isDirectory() && existsSync(specFile)
			);
		})
		.map((entry) => {
			const content = readFileSync(join(specsDir, entry, "spec.md"), "utf-8");
			return { name: entry, content };
		});
}

function findItemSpec(
	item: Workflow["items"][number],
	specs: SpecInfo[],
): SpecInfo | undefined {
	const desc = item.description.toLowerCase();
	return specs.find(
		(s) =>
			desc.includes(s.name.toLowerCase().replace(/-/g, " ")) ||
			desc.includes(s.name.toLowerCase()),
	);
}

function boardHtml(workflow: Workflow | null, specs: SpecInfo[] = []): string {
	const stages = workflow?.stages ?? [];
	const items = workflow?.items ?? [];
	const itemsByStage = new Map<string, typeof items>();
	for (const s of stages) itemsByStage.set(s.id, []);
	for (const it of items) {
		const list = itemsByStage.get(it.stage);
		if (list) list.push(it);
	}

	function ageLabel(createdAt: string): string {
		const age = Math.floor(
			(Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
		);
		if (age === 0) return "today";
		if (age === 1) return "1d ago";
		return `${age}d ago`;
	}

	const stageCards = stages
		.map((s) => {
			const stageItems = itemsByStage.get(s.id) ?? [];
			const itemsHtml =
				stageItems.length === 0
					? '<div class="empty">(empty)</div>'
					: stageItems
							.map((it) => {
								const spec = findItemSpec(it, specs);
								const specBtn = spec
									? `<button class="spec-btn" data-spec="${esc(spec.name)}">spec</button>`
									: "";
								return `<div class="item stage-${esc(s.id)}"><span class="item-id">${it.id}</span><span class="item-desc">${esc(it.description)}</span><span class="item-bottom">${specBtn}<span class="item-age">${ageLabel(it.createdAt)}</span></span></div>`;
							})
							.join("");
			const count = stageItems.length;
			return `<div class="stage stage-${esc(s.id)}"><h2>${esc(s.name)} <span class="count">${count} ${count === 1 ? "item" : "items"}</span></h2><div class="items">${itemsHtml}</div></div>`;
		})
		.join("\n");

	const name = workflow ? esc(workflow.name) : "No workflow";
	const updatedAt = workflow
		? new Date(workflow.updatedAt).toLocaleString()
		: "-";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Flow Board</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0f1117; color: #e1e4e8;
    padding: 2rem 1rem; max-width: 1200px; margin: 0 auto;
  }
  header {
    display: flex; justify-content: space-between; align-items: center;
  }
  .brand {
    display: flex; align-items: center; gap: 0.625rem;
  }
  .brand svg { width: 36px; height: 36px; flex-shrink: 0; }
  .brand-text { font-weight: 600; font-size: 1rem; color: #e1e4e8; }
  .brand-text span { color: #8b949e; font-weight: 300; }
  .header-status { color: #8b949e; font-size: 0.75rem; }
  .live { color: #3fb950; }
  .live::before { content: "●"; margin-right: 0.3rem; }
  .project-desc { margin: 15px 0 1.5rem; }
  .project-desc h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.25rem; }
  .project-desc p { color: #8b949e; font-size: 0.9rem; line-height: 1.4; }
  .board-scroll { overflow-x: auto; padding-bottom: 0.5rem; }
  .board { display: flex; gap: 1rem; }
  .stage {
    flex: 0 0 280px; width: 280px;
    background: #161b22; border: 1px solid #30363d; border-top: 3px solid #30363d;
    border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;
    transition: border-top-color .2s;
  }
  .stage.stage-backlog { border-top-color: #8b949e; }
  .stage.stage-design { border-top-color: #d29922; }
  .stage.stage-code { border-top-color: #58a6ff; }
  .stage.stage-review { border-top-color: #bc8cff; }
  .stage.stage-done { border-top-color: #3fb950; }
  .stage h2 { font-size: 1rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
  .count { font-size: 0.7rem; color: #8b949e; font-weight: 400; background: rgba(139,148,158,0.1); padding: 0.15rem 0.5rem; border-radius: 10px; }
  .items { display: flex; flex-direction: column; gap: 0.5rem; min-height: 2rem; }
  .empty { color: #484f58; font-size: 0.8rem; padding: 0.75rem 0; text-align: center; border: 1px dashed #21262d; border-radius: 6px; }
  .item {
    background: #0f1117; border-radius: 8px; padding: 0.625rem 0.75rem;
    display: flex; flex-direction: column; gap: 0.3rem;
    border-left: 3px solid #30363d; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    transition: border-color .15s, transform .15s, box-shadow .15s;
  }
  .item:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.3); }
  .item.stage-backlog { border-left-color: #8b949e; }
  .item.stage-design { border-left-color: #d29922; }
  .item.stage-code { border-left-color: #58a6ff; }
  .item.stage-review { border-left-color: #bc8cff; }
  .item.stage-done { border-left-color: #3fb950; }
  .item-id {
    font-family: monospace; font-size: 0.65rem; color: #58a6ff; font-weight: 600;
    background: rgba(88,166,255,0.1); padding: 0.1rem 0.4rem; border-radius: 4px;
    display: inline-block; width: fit-content;
  }
  .item-desc { font-size: 0.85rem; color: #e1e4e8; line-height: 1.35; margin-top: 0.1rem; }
  .item-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem; }
  .item-age { font-size: 0.65rem; color: #8b949e; }
  .spec-btn {
    background: none; border: 1px solid #30363d; border-radius: 4px;
    color: #8b949e; font-size: 0.6rem; padding: 0.1rem 0.4rem;
    cursor: pointer; font-family: monospace; transition: .15s;
  }
  .spec-btn:hover { border-color: #58a6ff; color: #58a6ff; background: rgba(88,166,255,0.08); }
  .board-fade { animation: fadeIn .3s ease; }
  @keyframes fadeIn { from { opacity: 0.5; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
  .modal.hidden { display: none; }
  .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); }
  .modal-content {
    position: relative; background: #161b22; border: 1px solid #30363d;
    border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh;
    display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.25rem; border-bottom: 1px solid #30363d;
  }
  .modal-header h2 { font-size: 1rem; font-weight: 600; }
  .modal-close {
    background: none; border: none; color: #8b949e; font-size: 1.5rem;
    cursor: pointer; line-height: 1; padding: 0;
  }
  .modal-close:hover { color: #e1e4e8; }
  .modal-body {
    padding: 1.25rem; overflow-y: auto; font-size: 0.875rem; line-height: 1.6;
    white-space: pre-wrap; font-family: monospace; color: #e1e4e8;
  }
  .modal-body h1, .modal-body h2, .modal-body h3 { font-family: system-ui; margin: 1rem 0 0.5rem; }
  .modal-body h1 { font-size: 1.2rem; }
  .modal-body h2 { font-size: 1rem; color: #58a6ff; }
  .modal-body h3 { font-size: 0.9rem; color: #d29922; }
  .modal-body ul, .modal-body ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .modal-body li { margin-bottom: 0.25rem; }
  .modal-body code { background: #0f1117; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.8rem; }
  .modal-body pre { background: #0f1117; padding: 0.75rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; }
  .modal-body pre code { background: none; padding: 0; }
  @media (max-width: 600px) {
    .board { grid-template-columns: 1fr; }
    body { padding: 1rem 0.5rem; }
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#d29922"/>
      <path d="M20 10l10 14-10 14-10-14L20 10z" fill="#0f1117"/>
      <circle cx="20" cy="24" r="3" fill="#d29922"/>
    </svg>
    <div class="brand-text">letra<span>.dev</span></div>
  </div>
  <div class="header-status">
    <span class="live"></span>
    <span id="status">connected</span>
    <span>&middot; updated ${updatedAt}</span>
  </div>
</header>
<div class="project-desc" id="projectDesc">
  <h1>${name}</h1>
  ${workflow?.description ? `<p>${esc(workflow.description)}</p>` : ""}
</div>
<div class="board-scroll">
  <div class="board" id="board">
    ${stageCards}
  </div>
</div>
<div id="modal" class="modal hidden">
  <div class="modal-backdrop" id="modalBackdrop"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h2 id="modalTitle"></h2>
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>
<script>
var __specs = null;
fetch("/api/specs").then(r => r.json()).then(s => { __specs = s; attachSpecButtons(); }).catch(() => {});
const evtSource = new EventSource("/events");
evtSource.addEventListener("workflow-updated", () => {
  document.getElementById("status").textContent = "refreshing...";
  fetch("/api/workflow")
    .then(r => r.json())
    .then(data => {
      document.getElementById("status").textContent = "updated " + new Date().toLocaleTimeString();
      renderBoard(data);
    })
    .catch(() => {
      document.getElementById("status").textContent = "update failed";
    });
});
evtSource.onerror = () => {
  document.getElementById("status").textContent = "disconnected";
};
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function ageLabel(createdAt) {
  const age = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (age === 0) return "today";
  if (age === 1) return "1d ago";
  return age + "d ago";
}
function matchSpec(desc, specs) {
  const lower = desc.toLowerCase();
  for (const s of specs) {
    if (lower.includes(s.name.replace(/-/g, " ")) || lower.includes(s.name)) return s.name;
  }
  return null;
}
function renderBoard(wf) {
  const sorted = (wf.stages || []).sort((a, b) => a.order - b.order);
  const itemsByStage = {};
  for (const s of sorted) itemsByStage[s.id] = [];
  for (const it of (wf.items || [])) {
    const list = itemsByStage[it.stage];
    if (list) list.push(it);
  }
  const html = sorted.map(s => {
    const stageItems = itemsByStage[s.id] || [];
    const itemsHtml = stageItems.length === 0
      ? '<div class="empty">(empty)</div>'
      : stageItems.map(it => {
          const specName = matchSpec(it.description, __specs || []);
          const specBtn = specName ? '<button class="spec-btn" data-spec="' + esc(specName) + '">spec</button>' : "";
          return '<div class="item stage-' + esc(s.id) + '"><span class="item-id">' + esc(it.id) + '</span><span class="item-desc">' + esc(it.description) + '</span><span class="item-bottom">' + specBtn + '<span class="item-age">' + ageLabel(it.createdAt) + '</span></span></div>';
        }).join("");
    return '<div class="stage stage-' + esc(s.id) + '"><h2>' + esc(s.name) + ' <span class="count">' + stageItems.length + ' ' + (stageItems.length === 1 ? "item" : "items") + '</span></h2><div class="items">' + itemsHtml + '</div></div>';
  }).join("\\n");
  const board = document.getElementById("board");
  board.classList.remove("board-fade");
  board.innerHTML = html;
  void board.offsetWidth;
  board.classList.add("board-fade");
  document.getElementById("projectDesc").querySelector("h1").textContent = wf.name || "Flow Board";
  updateMeta(wf.updatedAt);
  attachSpecButtons();
}
function updateMeta(updatedAt) {
  const status = document.getElementById("status");
  if (status) status.textContent = "connected" + (updatedAt ? " · updated " + new Date(updatedAt).toLocaleString() : "");
}
function attachSpecButtons() {
  document.querySelectorAll(".spec-btn").forEach(btn => {
    btn.addEventListener("click", () => openSpec(btn.dataset.spec));
  });
}
function openSpec(name) {
  const spec = (__specs || []).find(s => s.name === name);
  if (!spec) {
    document.getElementById("modalTitle").textContent = "Spec: " + name;
    document.getElementById("modalBody").textContent = "Loading...";
    document.getElementById("modal").classList.remove("hidden");
    fetch("/api/specs").then(r => r.json()).then(all => {
      __specs = all;
      const s = all.find(x => x.name === name);
      if (s) {
        document.getElementById("modalTitle").textContent = "Spec: " + name;
        document.getElementById("modalBody").textContent = s.content;
      }
    }).catch(() => {
      document.getElementById("modalBody").textContent = "Failed to load spec.";
    });
    return;
  }
  document.getElementById("modalTitle").textContent = "Spec: " + name;
  document.getElementById("modalBody").textContent = spec.content;
  document.getElementById("modal").classList.remove("hidden");
}
document.getElementById("modalClose").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});
document.getElementById("modalBackdrop").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("modal").classList.add("hidden");
});
attachSpecButtons();
<${"/" + "script"}>
</body>
</html>`;
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export class FlowServer {
	private server: ReturnType<typeof createServer> | undefined;
	private watcher: ReturnType<typeof watch> | undefined;
	private clients: Set<ServerResponse> = new Set();
	private root: string;
	private port: number;
	private loadWorkflow;

	constructor(root: string, port: number = DEFAULT_PORT) {
		this.root = root;
		this.port = port;
		this.loadWorkflow = () => loadWorkflow(root);
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

		if (path === "/api/specs") {
			const specs = loadSpecs(this.root);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(specs));
			return;
		}

		const wf = this.loadWorkflow();
		const specs = loadSpecs(this.root);
		const html = boardHtml(wf, specs);
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(html);
	};

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
				resolve();
			});
			this.server.on("error", reject);
		});
	}

	stop(): void {
		if (this.watcher) this.watcher.close();
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
		console.error(
			`Failed to start server on port ${port}:`,
			(err as Error).message,
		);
		process.exit(1);
	}
}
