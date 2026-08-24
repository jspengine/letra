import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { type Workflow, loadWorkflow, writeWorkflow } from "./flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";

function now(): string {
	return new Date().toISOString();
}

function normalizeVersion(v: string): string {
	const parts = v.split(".");
	if (parts.length === 2) return `${v}.0`;
	return v;
}

function incrementVersion(v: string): string {
	const parts = normalizeVersion(v).split(".").map(Number);
	parts[1] += 1;
	parts[2] = 0;
	return parts.join(".");
}

function loadBackup(root: string, version: string): Workflow | null {
	const path = join(getLetraDir(root), `workflow.v${version}.json`);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as Workflow;
	} catch {
		return null;
	}
}

function loadVersion(root: string, version: string): Workflow | null {
	const backup = loadBackup(root, version);
	if (backup) return backup;
	const current = loadWorkflow(root);
	if (current && normalizeVersion(current.version) === version) return current;
	return null;
}

function getLatestBackupVersion(root: string): string | null {
	const dir = getLetraDir(root);
	if (!existsSync(dir)) return null;
	const files = readdirSync(dir).filter((f) => f.startsWith("workflow.v") && f.endsWith(".json"));
	if (files.length === 0) return null;
	const versions = files.map((f) => f.replace("workflow.v", "").replace(".json", ""));
	versions.sort((a, b) => {
		const pa = a.split(".").map(Number);
		const pb = b.split(".").map(Number);
		for (let i = 0; i < 3; i++) {
			if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
		}
		return 0;
	});
	return versions[versions.length - 1];
}

function backupFilePath(root: string, version: string): string {
	return join(getLetraDir(root), `workflow.v${version}.json`);
}

export function flowEdit(root: string, options: { name?: string; desc?: string }): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}

	const currentVersion = normalizeVersion(workflow.version);
	const backupPath = backupFilePath(root, currentVersion);

	if (!existsSync(backupPath)) {
		writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
	}

	if (options.name !== undefined) {
		workflow.name = options.name;
	}
	if (options.desc !== undefined) {
		workflow.description = options.desc;
	}

	workflow.version = incrementVersion(workflow.version);
	workflow.updatedAt = now();
	writeWorkflow(root, { workflow, source: "flow-edit", skipSitrep: true });

	console.log(`  ${chalk.green("✓")} Workflow updated to v${workflow.version}`);
	if (options.name !== undefined) {
		console.log(`    Name: ${chalk.cyan(options.name)}`);
	}
	if (options.desc !== undefined) {
		console.log(`    Description: ${chalk.cyan(options.desc)}`);
	}
}

interface DiffResult {
	name: string | null;
	stagesAdded: string[];
	stagesRemoved: string[];
	itemsNew: Array<{ id: string; stage: string }>;
	itemsMoved: Array<{ id: string; from: string; to: string }>;
	itemsRemoved: Array<{ id: string; stage: string }>;
}

function stageName(workflow: Workflow, stageId: string): string {
	return workflow.stages.find((s) => s.id === stageId)?.name || stageId;
}

function computeDiff(oldWf: Workflow, newWf: Workflow): DiffResult {
	const nameDiff = oldWf.name !== newWf.name ? `"${oldWf.name}" → "${newWf.name}"` : null;

	const oldStageNames = new Set(oldWf.stages.map((s) => s.name));
	const newStageNames = new Set(newWf.stages.map((s) => s.name));

	const stagesAdded = newWf.stages.filter((s) => !oldStageNames.has(s.name)).map((s) => s.name);
	const stagesRemoved = oldWf.stages.filter((s) => !newStageNames.has(s.name)).map((s) => s.name);

	const oldItemMap = new Map(oldWf.items.map((i) => [i.id, i]));
	const newItemMap = new Map(newWf.items.map((i) => [i.id, i]));

	const itemsNew: Array<{ id: string; stage: string }> = [];
	const itemsMoved: Array<{ id: string; from: string; to: string }> = [];
	const itemsRemoved: Array<{ id: string; stage: string }> = [];

	for (const [id, item] of newItemMap) {
		if (!oldItemMap.has(id)) {
			itemsNew.push({ id, stage: stageName(newWf, item.stage) });
		} else {
			const oldItem = oldItemMap.get(id);
			if (oldItem && oldItem.stage !== item.stage) {
				itemsMoved.push({
					id,
					from: stageName(oldWf, oldItem.stage),
					to: stageName(newWf, item.stage),
				});
			}
		}
	}

	for (const [id, item] of oldItemMap) {
		if (!newItemMap.has(id)) {
			itemsRemoved.push({ id, stage: stageName(oldWf, item.stage) });
		}
	}

	return {
		name: nameDiff,
		stagesAdded,
		stagesRemoved,
		itemsNew,
		itemsMoved,
		itemsRemoved,
	};
}

function formatDiff(wfName: string, diff: DiffResult): string[] {
	const lines: string[] = [];
	lines.push(`Workflow: ${wfName}`);

	if (diff.name) {
		lines.push(`  Name: ${diff.name}`);
	}

	if (diff.stagesAdded.length > 0 || diff.stagesRemoved.length > 0) {
		const parts: string[] = [];
		for (const s of diff.stagesAdded) parts.push(`+${s}`);
		for (const s of diff.stagesRemoved) parts.push(`-${s}`);
		lines.push(`  Stages: ${parts.join(", ")}`);
	}

	const itemParts: string[] = [];
	for (const item of diff.itemsNew) {
		itemParts.push(`+${item.id} (${item.stage})`);
	}
	for (const item of diff.itemsMoved) {
		itemParts.push(`${item.id} moved: ${item.from} → ${item.to}`);
	}
	for (const item of diff.itemsRemoved) {
		itemParts.push(`-${item.id} (${item.stage})`);
	}
	if (itemParts.length > 0) {
		lines.push(`  Items: ${itemParts.join(", ")}`);
	}

	return lines;
}

function stripVPrefix(v: string): string {
	return v.replace(/^v/, "");
}

export function flowDiff(root: string, v1?: string, v2?: string): void {
	const current = loadWorkflow(root);
	if (!current) {
		console.log(chalk.yellow("No workflow found"));
		return;
	}

	if (v1 && v2) {
		const wf1 = loadVersion(root, stripVPrefix(v1));
		const wf2 = loadVersion(root, stripVPrefix(v2));
		if (!wf1 && !wf2) {
			console.log(chalk.yellow(`No backups found for versions ${v1} and ${v2}`));
			return;
		}
		if (!wf1) {
			console.log(chalk.yellow(`No backup found for version ${v1}`));
			return;
		}
		if (!wf2) {
			console.log(chalk.yellow(`No backup found for version ${v2}`));
			return;
		}
		const diff = computeDiff(wf1, wf2);
		const lines = formatDiff(wf2.name, diff);
		for (const line of lines) console.log(line);
	} else {
		const latestVersion = getLatestBackupVersion(root);
		if (!latestVersion) {
			console.log(chalk.yellow("No backup versions found to compare"));
			return;
		}
		const backup = loadBackup(root, latestVersion);
		if (!backup) {
			console.log(chalk.yellow(`Failed to load backup version ${latestVersion}`));
			return;
		}
		const diff = computeDiff(backup, current);
		const lines = formatDiff(current.name, diff);
		for (const line of lines) console.log(line);
	}
}

export function flowEditAction(
	targetPath: string | undefined,
	options: { name?: string; desc?: string },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowEdit(root, options);
}

export function flowDiffAction(targetPath: string | undefined, v1?: string, v2?: string): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowDiff(root, v1, v2);
}
