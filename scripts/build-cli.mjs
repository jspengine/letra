// Build script: first build shared packages, then client, then CLI, then copy client dist into CLI package
import { execSync } from "node:child_process";
import { existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const uiDir = join(root, "packages", "ui");
const clientDir = join(root, "packages", "client");
const cliDir = join(root, "packages", "cli");

// Step 0: Build shared packages
console.log("[build] Building @letra/ui...");
execSync("npm run build", { cwd: uiDir, stdio: "inherit" });

// Step 1: Build client
console.log("[build] Building client...");
execSync("npm run build", { cwd: clientDir, stdio: "inherit" });

// Step 2: Build CLI
console.log("[build] Building CLI...");
execSync("npx tsup", { cwd: cliDir, stdio: "inherit" });

// Step 3: Copy default harness files into CLI output
const harnessDefaultDir = join(cliDir, "src", "harness", "default");
const cliHarnessDir = join(cliDir, "dist", "harness", "default");
if (existsSync(harnessDefaultDir)) {
	console.log("[build] Copying default harness to CLI dist...");
	cpSync(harnessDefaultDir, cliHarnessDir, { recursive: true });
}

// Step 4: Copy client dist into CLI output
const clientDist = join(clientDir, "dist");
const cliClientDir = join(cliDir, "dist", "client");
if (existsSync(clientDist)) {
	console.log("[build] Copying client dist to CLI package...");
	cpSync(clientDist, cliClientDir, { recursive: true });
	console.log("[build] Done.");
}
