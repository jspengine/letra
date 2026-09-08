// Exercise the tarball as a consumer, without the monorepo's dependencies or user data.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
assert(npmCli, "Run this check with npm run test:package");
const { values } = parseArgs({ options: { "pack-destination": { type: "string" } } });
const scratchDir = mkdtempSync(join(tmpdir(), "letra-package-"));
const installDir = join(scratchDir, "consumer");
const homeDir = join(scratchDir, "home");
const projectDir = join(scratchDir, "project");
const packDir = values["pack-destination"] ? resolve(values["pack-destination"]) : join(scratchDir, "packed");
for (const dir of [installDir, homeDir, projectDir, packDir]) mkdirSync(dir, { recursive: true });
const expected = JSON.parse(readFileSync(join(repoDir, "packages/cli/package.json"), "utf8"));
const consumerEnv = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
// No inherited workspace or Node resolution override may hide an installation failure.
for (const key of ["LETRA_WORKSPACE", "NODE_PATH", "NODE_OPTIONS"]) delete consumerEnv[key];

function run(args, cwd = installDir, env = consumerEnv) {
	const result = spawnSync(process.execPath, args, {
		cwd, env, encoding: "utf8", timeout: 180_000, windowsHide: true,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 0, `${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
	return result.stdout.trim();
}

async function freePort() {
	const probe = createServer();
	probe.listen(0, "127.0.0.1");
	await once(probe, "listening");
	const port = probe.address().port;
	await new Promise((resolveClose, reject) => probe.close((error) => error ? reject(error) : resolveClose()));
	return port;
}

let server;
let serverOutput = "";
try {
	console.log("[package] Packing the CLI...");
	const [packed] = JSON.parse(run([
		npmCli, "pack", "--workspace=packages/cli", "--json", "--pack-destination", packDir,
	], repoDir, process.env));
	const tarball = join(packDir, packed.filename);
	for (const path of ["dist/index.js", "dist/index.d.ts", "dist/client/index.html", "dist/harness/default/v0.2.0/roles/analyst.yaml"]) {
		assert(packed.files.some((file) => file.path === path), `Tarball is missing ${path}`);
	}
	assert(packed.files.some((file) => /^dist\/chunk-.+\.js$/.test(file.path)), "Tarball is missing CLI chunks");
	assert(packed.files.every((file) => file.path.startsWith("dist/") || /^(package\.json|readme(?:\..*)?|licen[cs]e(?:\..*)?)$/i.test(file.path)), "Unexpected development files in tarball");

	console.log("[package] Installing into a clean consumer directory...");
	writeFileSync(join(installDir, "package.json"), JSON.stringify({ name: "letra-package-smoke", version: "1.0.0", private: true }));
	run([npmCli, "install", "--omit=dev", "--no-audit", "--no-fund", tarball]);
	const installedDir = join(installDir, "node_modules/@letra-ai/cli");
	const installed = JSON.parse(readFileSync(join(installedDir, "package.json"), "utf8"));
	assert.equal(installed.version, expected.version);
	assert(!installed.dependencies?.["@letra/types"], "Internal types must not be a runtime dependency");
	const cli = join(installedDir, installed.bin.letra);
	assert.equal(run([cli, "--version"]), expected.version);
	assert.match(run([cli, "--help"]), /Usage: letra/);
	assert.match(run([cli, "flow", "--help"]), /serve/);
	assert.match(run([cli, "mcp", "--help"]), /mcp/);

	console.log("[package] Initializing an isolated workspace with the shipped harness...");
	run([cli, "init", "--workspace", "package-smoke", "--yes"], projectDir);
	const workspaceDir = readFileSync(join(projectDir, ".letra-link"), "utf8").trim();
	const relativeWorkspace = relative(homeDir, workspaceDir);
	assert(!isAbsolute(relativeWorkspace) && !relativeWorkspace.startsWith(".."), "Workspace escaped the isolated home");
	assert(existsSync(join(workspaceDir, "workflow.json")), "Workspace initialization failed");
	assert(!existsSync(join(projectDir, ".letra")), "Initialization created a project-local harness");
	const pulse = JSON.parse(run([cli, "pulse", "--json"], projectDir));
	assert.equal(pulse.workspace, "package-smoke");
	const port = await freePort();
	const baseUrl = `http://127.0.0.1:${port}`;
	server = spawn(process.execPath, [cli, "flow", "serve", "--port", String(port)], {
		cwd: projectDir, env: consumerEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
	});
	server.stdout.on("data", (chunk) => { serverOutput += chunk; });
	server.stderr.on("data", (chunk) => { serverOutput += chunk; });
	let response;
	for (let attempt = 0; attempt < 80; attempt++) {
		assert.equal(server.exitCode, null, `Installed server exited:\n${serverOutput}`);
		try { response = await fetch(`${baseUrl}/api/workflow`, { signal: AbortSignal.timeout(1000) }); } catch {}
		if (response?.ok) break;
		await delay(250);
	}
	assert(response?.ok, `Installed server did not start:\n${serverOutput}`);
	const workflowResponse = await response.json();
	assert.equal(workflowResponse.name, "package-smoke");
	const page = await fetch(baseUrl);
	assert.equal(page.status, 200);
	const html = await page.text();
	const assets = [...html.matchAll(/(?:src|href)="(?:\.)?(\/assets\/[^"]+)"/g)].map((match) => match[1]);
	assert(assets.some((asset) => asset.endsWith(".js")), "Installed UI is missing its JavaScript entry");
	assert(assets.some((asset) => asset.endsWith(".css")), "Installed UI is missing its stylesheet");
	for (const asset of assets) {
		const assetResponse = await fetch(new URL(asset, baseUrl));
		assert.equal(assetResponse.status, 200, `Missing installed asset: ${asset}`);
		assert(!(assetResponse.headers.get("content-type") ?? "").includes("text/html"), `Asset fell back to HTML: ${asset}`);
	}
	console.log(`[package] PASS: ${installed.name}@${installed.version}; CLI, workspace, API and web assets verified.`);
	if (values["pack-destination"]) {
		console.log(`[package] Tested tarball: ${tarball}`);
		if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tarball=${tarball}\n`);
	}
} finally {
	if (server && server.exitCode === null) {
		const exited = once(server, "exit");
		server.kill();
		await exited;
	}
	// Delete only the exact temporary directory allocated by this invocation.
	assert(dirname(scratchDir) === tmpdir() && scratchDir.startsWith(join(tmpdir(), "letra-package-")));
	rmSync(scratchDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
