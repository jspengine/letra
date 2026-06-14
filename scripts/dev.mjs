// Dev script: runs Vite dev server + CLI in parallel
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const clientDir = join(root, "packages", "client");

// Start Vite
const vite = spawn("npm", ["run", "dev"], {
	cwd: clientDir,
	stdio: "inherit",
	shell: true,
});

// Wait a bit for Vite to start, then start CLI
setTimeout(() => {
	const cli = spawn("node", [join(root, "dist", "index.js"), "flow", "serve"], {
		cwd: root,
		stdio: "inherit",
		shell: true,
	});
	cli.on("close", () => {
		vite.kill();
		process.exit();
	});
}, 3000);

process.on("SIGINT", () => {
	vite.kill();
	process.exit();
});
