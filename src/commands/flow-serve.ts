import { watch, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { loadWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";

const DEFAULT_PORT = 3000;

function boardHtml(workflow: Workflow | null): string {
	const stages = workflow?.stages ?? [];
	const items = workflow?.items ?? [];
	const itemsByStage = new Map<string, typeof items>();
	for (const s of stages) itemsByStage.set(s.id, []);
	for (const it of items) {
		const list = itemsByStage.get(it.stage);
		if (list) list.push(it);
	}

	const stageCards = stages
		.map((s) => {
			const stageItems = itemsByStage.get(s.id) ?? [];
			const rows =
				stageItems.length === 0
					? '<tr class="empty"><td colspan="2">(empty)</td></tr>'
					: stageItems
						.map(
							(it) =>
								`<tr><td class="id">${it.id}</td><td>${esc(it.description)}</td></tr>`,
						)
						.join("");
			const stageClass = `stage-${s.id}`;
			const count = stageItems.length;
			return `<div class="stage ${stageClass}">
        <h2>${esc(s.name)} <span class="count">${count} ${count === 1 ? "item" : "items"}</span></h2>
        <table>${rows}</table>
      </div>`;
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
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem;
  }
  h1 { font-size: 1.5rem; font-weight: 600; }
  .meta { color: #8b949e; font-size: 0.875rem; }
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .stage {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 1rem;
  }
  .stage h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
  .count { font-size: 0.75rem; color: #8b949e; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.4rem 0; border-bottom: 1px solid #21262d; font-size: 0.875rem; }
  .empty td { color: #484f58; font-style: italic; }
  .id { color: #58a6ff; font-family: monospace; width: 5.5rem; }
  .status-bar {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 0.75rem 1rem; margin-bottom: 1rem;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.875rem; color: #8b949e;
  }
  .status-bar .live { color: #3fb950; }
  .status-bar .live::before { content: "●"; margin-right: 0.4rem; }
  @media (max-width: 600px) {
    .board { grid-template-columns: 1fr; }
    body { padding: 1rem 0.5rem; }
  }
</style>
</head>
<body>
<header>
  <h1>${name}</h1>
  <span class="meta">updated ${updatedAt}</span>
</header>
<div class="status-bar">
  <span class="live">Live</span>
  <span id="status">connected</span>
</div>
<div class="board" id="board">
  ${stageCards}
</div>
<script>
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
    const rows = stageItems.length === 0
      ? '<tr class="empty"><td colspan="2">(empty)</td></tr>'
      : stageItems.map(it => '<tr><td class="id">' + esc(it.id) + '</td><td>' + esc(it.description) + '</td></tr>').join("");
    return '<div class="stage stage-' + esc(s.id) + '"><h2>' + esc(s.name) + ' <span class="count">' + stageItems.length + ' ' + (stageItems.length === 1 ? "item" : "items") + '</span></h2><table>' + rows + '</table></div>';
  }).join("\\n");
  document.getElementById("board").innerHTML = html;
  document.querySelector("h1").textContent = wf.name || "Flow Board";
  document.querySelector(".meta").textContent = "updated " + (wf.updatedAt ? new Date(wf.updatedAt).toLocaleString() : "-");
}
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

		const wf = this.loadWorkflow();
		const html = boardHtml(wf);
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(html);
	};

	private broadcast(): void {
		if (this.clients.size === 0) return;
		const data = `event: workflow-updated\ndata: {}\n\n`;
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
			const cmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
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
