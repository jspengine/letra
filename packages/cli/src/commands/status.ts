import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import chalk from "chalk";
import { detectManifest, listWorkspaces, loadWorkspaceInfo, getWorkspacePath } from "../workspace/index.js";

export async function status(cwd?: string): Promise<void> {
	const root = resolve(process.cwd(), cwd || ".");

	const manifest = detectManifest(root);
	if (manifest) {
		const { manifest: m } = manifest;
		console.log(chalk.bold("\n╔══════════════════════════════════════╗"));
		console.log(chalk.bold("║     Status do Workspace              ║"));
		console.log(chalk.bold("╚══════════════════════════════════════╝\n"));

		console.log(`  ${chalk.bold("Workspace:")}  ${m.workspaceId}`);
		console.log(`  ${chalk.bold("Projeto:")}    ${m.projectId}`);
		console.log(`  ${chalk.bold("Template:")}   ${m.templateId}`);
		console.log(`  ${chalk.bold("Harness:")}    ${m.harnessVersion}`);
		console.log(`  ${chalk.bold("Gates:")}      ${m.gates.join(", ")}`);
		console.log(`  ${chalk.bold("Repos:")}      ${m.repositories.length}`);
		console.log(`  ${chalk.bold("Manifest:")}   ${pathToFileURL(manifest.path).href}`);

		const wsPath = getWorkspacePath(m.workspaceId);
		if (existsSync(wsPath)) {
			const info = loadWorkspaceInfo(m.workspaceId);
			if (info) {
				console.log(`\n  ${chalk.gray(`Workspace criado: ${new Date(info.createdAt).toLocaleDateString()}`)}`);
			}
		}
	} else {
		console.log(chalk.bold("\n╔══════════════════════════════════════╗"));
		console.log(chalk.bold("║     Workspaces Disponíveis           ║"));
		console.log(chalk.bold("╚══════════════════════════════════════╝\n"));

		const workspaces = listWorkspaces();
		if (workspaces.length === 0) {
			console.log("  Nenhum workspace encontrado.");
			console.log(`  Crie um com: ${chalk.cyan("letra init --workspace <nome>")}`);
		} else {
			for (const ws of workspaces) {
				console.log(`  ${chalk.green("●")} ${chalk.bold(ws.name)}`);
				console.log(`    ID: ${ws.id}`);
				console.log(`    Template: ${ws.templateId}`);
				console.log(`    Criado: ${new Date(ws.createdAt).toLocaleDateString()}`);
				console.log(`    Arquivo: ${pathToFileURL(getWorkspacePath(ws.name) + "/workspace.json").href}`);
				console.log();
			}
		}
	}
	console.log();
}
