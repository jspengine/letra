import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export class ClientAssets {
	private clientDir: string | null = null;

	constructor(private readonly root: string) {}

	serve(path: string, req: IncomingMessage, res: ServerResponse): void {
		if (!this.clientDir) {
			const moduleDir = dirname(fileURLToPath(import.meta.url));
			const candidates = [
				join(moduleDir, "client"),
				join(this.root, "packages", "client", "dist"),
				join(moduleDir, "..", "..", "..", "client", "dist"),
			];
			this.clientDir =
				candidates.find((directory) => existsSync(join(directory, "index.html"))) ?? null;
		}
		if (!this.clientDir) {
			this.proxyToVite(req, res);
			return;
		}
		let filePath = join(this.clientDir, path === "/" ? "index.html" : path);
		if (!existsSync(filePath)) filePath = join(this.clientDir, "index.html");
		const mime: Record<string, string> = {
			".html": "text/html; charset=utf-8",
			".js": "application/javascript; charset=utf-8",
			".css": "text/css; charset=utf-8",
			".svg": "image/svg+xml",
			".png": "image/png",
			".ico": "image/x-icon",
			".json": "application/json",
		};
		res.writeHead(200, {
			"Content-Type": mime[extname(filePath)] ?? "application/octet-stream",
		});
		res.end(readFileSync(filePath));
	}

	private proxyToVite(req: IncomingMessage, res: ServerResponse): void {
		fetch(`http://localhost:5173${req.url}`)
			.then((proxyRes) => {
				res.writeHead(proxyRes.status, Object.fromEntries(proxyRes.headers));
				return proxyRes.body?.pipeTo(new WritableStream({
					write: (chunk) => { res.write(chunk); },
					close: () => { res.end(); },
				}));
			})
			.catch(() => {
				res.writeHead(502, { "Content-Type": "text/plain" });
				res.end("Vite dev server not running on http://localhost:5173");
			});
	}
}
