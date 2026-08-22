import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import chalk from "chalk";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import type { Workflow, Item } from "./flow-init.js";
import { loadHealthRecord, getSummary } from "../health-record.js";
import { readFocusFile, syncFocus } from "../adapters/focus-sync.js";
import { resolveFocusRecommendations } from "../adapters/focus-recommendations.js";
import { resolveWorkspaceRoot } from "../workspace/resolver.js";
import { getLetraDir } from "./../workspace/resolver.js";

export interface PulseData {
	workspace: string;
	dataDir: string;
	locationPath: string;
	legacyWarning?: string;
	pulseAt: string;
	currentItem: {
		id: string;
		description: string;
		stage: string;
		stageName: string;
		daysInStage: number;
		spec: string | null;
		acs: { pending: number; done: number; total: number };
		tasks: { open: number; done: number; total: number };
		claimedBy?: string;
		claimedAt?: string;
	} | null;
	alerts: {
		novo: number;
		acknowledged: number;
		resolved: number;
		dismissed: number;
		highSeverity: number;
	};
	lastUpdated: string | null;
	daysIdle: number | null;
	nextItem: { id: string; description: string; stage: string } | null;
}

function daysSince(date: Date): number {
	return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function daysInStage(item: Item): number {
	return daysSince(new Date(item.createdAt));
}

function findCurrentItem(workflow: Workflow): Item | null {
	const activeStages = workflow.stages
		.filter((s) => s.zone === "doing" || (!s.zone && s.order > 0 && s.order < workflow.stages.length - 1))
		.map((s) => s.id);
	const stageSet = new Set(activeStages);
	if (stageSet.size === 0) {
		const middle = Math.floor(workflow.stages.length / 2);
		const stage = workflow.stages[middle];
		if (stage) stageSet.add(stage.id);
	}
	const items = workflow.items.filter((i) => stageSet.has(i.stage));
	if (items.length === 0) return null;
	return items.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

function findNextBacklog(workflow: Workflow): Item | null {
	const firstStage = workflow.stages[0];
	if (!firstStage) return null;
	const items = workflow.items.filter((i) => i.stage === firstStage.id);
	if (items.length === 0) return null;
	return items.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
}

function getStageName(workflow: Workflow, stageId: string): string {
	return workflow.stages.find((s) => s.id === stageId)?.name ?? stageId;
}

function countSpecACs(stateDir: string, specName: string): { pending: number; done: number; total: number } {
	let specDir = join(stateDir, "specs", specName);
	if (!existsSync(specDir)) {
		specDir = join(getLetraDir(stateDir), "specs", specName);
	}
	const specFile = join(specDir, "spec.md");
	if (!existsSync(specFile)) return { pending: 0, done: 0, total: 0 };
	try {
		const content = readFileSync(specFile, "utf-8");
		const boldPending = content.match(/-\s*\[ \]\s*\*\*AC[-]?\d+\*\*/g) || [];
		const boldDone = content.match(/-\s*\[[xX]\]\s*\*\*AC[-]?\d+\*\*/g) || [];
		if (boldPending.length > 0 || boldDone.length > 0) {
			return { pending: boldPending.length, done: boldDone.length, total: boldPending.length + boldDone.length };
		}
		const genericPending = content.match(/^- \[ \]\s+AC[-]?\d+/gm) || [];
		const genericDone = content.match(/^- \[[xX]\]\s+AC[-]?\d+/gm) || [];
		return { pending: genericPending.length, done: genericDone.length, total: genericPending.length + genericDone.length };
	} catch {
		return { pending: 0, done: 0, total: 0 };
	}
}

function getTaskCounts(item: Item): { open: number; done: number; total: number } {
	if (!item.tasks || item.tasks.length === 0) return { open: 0, done: 0, total: 0 };
	const done = item.tasks.filter((t) => t.done).length;
	return { open: item.tasks.length - done, done, total: item.tasks.length };
}

export async function pulse(
	rootPath: string,
	options?: { json?: boolean; build?: boolean; test?: boolean },
): Promise<PulseData> {
	const resolution = resolveWorkspaceRoot(rootPath);
	const statePath = resolution.workspaceDir;
	const workflow = loadWorkflow(resolution.targetDir);
	const name = workflow?.name ?? "meu-projeto";
	const legacyWarning = resolution.type === "local" && existsSync(join(resolution.workspaceRoot, ".letra", "workflow.json"))
		? "Workspace legado local detectado. Migre para um workspace externo com `letra migrate`."
		: undefined;

	if (!workflow) {
		const empty: PulseData = {
			workspace: name,
			dataDir: statePath,
			locationPath: resolution.locationPath,
			legacyWarning,
			pulseAt: new Date().toISOString(),
			currentItem: null,
			alerts: { novo: 0, acknowledged: 0, resolved: 0, dismissed: 0, highSeverity: 0 },
			lastUpdated: null,
			daysIdle: null,
			nextItem: null,
		};
		if (options?.json) {
			console.log(JSON.stringify(empty, null, 2));
		} else {
			renderPulseText(empty, false, statePath);
		}
		return empty;
	}

	const healthRecord = loadHealthRecord(resolution.type === "local" ? rootPath : statePath);
	const summary = getSummary(healthRecord);
	const currentItem = findCurrentItem(workflow);

	let acCounts = { pending: 0, done: 0, total: 0 };
	if (currentItem?.spec) {
		const specRoot = resolution.type === "local" ? rootPath : statePath;
		acCounts = countSpecACs(specRoot, currentItem.spec);
	}

	const pulseData: PulseData = {
		workspace: name,
		dataDir: statePath,
		locationPath: resolution.locationPath,
		legacyWarning,
		pulseAt: new Date().toISOString(),
		currentItem: currentItem
			? {
					id: currentItem.id,
					description: currentItem.description,
					stage: currentItem.stage,
					stageName: getStageName(workflow, currentItem.stage),
					daysInStage: daysInStage(currentItem),
					spec: currentItem.spec ?? null,
					acs: acCounts,
					tasks: getTaskCounts(currentItem),
					claimedBy: currentItem.claimedBy,
					claimedAt: currentItem.claimedAt,
				}
			: null,
		alerts: {
			novo: summary.novo,
			acknowledged: summary.ciente,
			resolved: summary.resolvido,
			dismissed: summary.descartado,
			highSeverity: summary.alta,
		},
		lastUpdated: workflow.updatedAt ?? null,
		daysIdle: workflow.updatedAt ? daysSince(new Date(workflow.updatedAt)) : null,
		nextItem: findNextBacklog(workflow)
			? {
					id: findNextBacklog(workflow)!.id,
					description: findNextBacklog(workflow)!.description,
					stage: findNextBacklog(workflow)!.stage,
				}
			: null,
	};

	const focusRoot = resolution.type === "local" ? rootPath : statePath;
	const focusResult = syncFocus(
		focusRoot,
		workflow,
		currentItem ? resolveFocusRecommendations(focusRoot, currentItem.id) : [],
	);
	if (focusResult.cleared) {
		console.log(chalk.yellow("  focus.md limpo — item referenciado não encontrado no workflow"));
	}

	const focusData = readFocusFile(focusRoot);
	let focusDiverged = false;
	if (focusData && currentItem?.spec && focusData.specName !== currentItem.spec) {
		focusDiverged = true;
	}

	if (options?.json) {
		const pulseJson = { ...pulseData, focusDiverged };
		console.log(JSON.stringify(pulseJson, null, 2));
	} else {
		renderPulseText(pulseData, focusDiverged, statePath);
	}

	return pulseData;
}

function renderPulseText(data: PulseData, focusDiverged = false, statePath?: string): void {
	const dateStr = new Date(data.pulseAt).toLocaleDateString("pt-BR", {
		day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
	});

	console.log(`\n${chalk.bold("╔══════════════════════════════════════════╗")}`);
	console.log(`${chalk.bold("║     Pulso do Workspace")}                  `);
	console.log(`${chalk.bold("║")}     ${chalk.gray(`${data.workspace} · ${dateStr}`)}`);
	console.log(`${chalk.bold("╚══════════════════════════════════════════╝")}\n`);
	if (data.legacyWarning) {
		console.log(`  ${chalk.yellow(data.legacyWarning)}`);
		console.log();
	}

	if (data.currentItem) {
		const ci = data.currentItem;
		console.log(`  ${chalk.bold("Item em andamento:")}`);
		if (statePath) {
			console.log(`    ${chalk.gray(`Workflow: ${pathToFileURL(join(statePath, "workflow.json")).href}`)}`);
		}
		console.log(`    ${chalk.cyan(ci.id)} · ${ci.description}`);
		const agentInfo = ci.claimedBy ? ` 🤖 Agent: ${ci.claimedBy}` : "";
		console.log(`    ${chalk.gray(`Estágio: ${ci.stageName} · ${ci.daysInStage} dia(s) no estágio${agentInfo}`)}`);
		console.log(`    ${chalk.gray(`ACs: ${ci.acs.pending}/${ci.acs.total} pendentes (${ci.acs.done} feito(s))`)}`);
		if (ci.tasks.total > 0) {
			console.log(`    ${chalk.gray(`Tasks: ${ci.tasks.open}/${ci.tasks.total} abertas (${ci.tasks.done} feita(s))`)}`);
		}
		if (ci.spec) {
			const specReference = statePath
				? pathToFileURL(join(statePath, "specs", ci.spec, "spec.md")).href
				: `.letra/specs/${ci.spec}/spec.md`;
			console.log(`    ${chalk.gray(`Spec: ${specReference}`)}`);
		} else {
			console.log(`    ${chalk.yellow("⚠ sem spec associada")}`);
		}
	} else {
		console.log(`  ${chalk.yellow("Nenhum item em andamento.")}`);
	}
	console.log();

	const alerts = data.alerts;
	if (alerts.novo > 0 || alerts.acknowledged > 0 || alerts.resolved > 0) {
		console.log(`  ${chalk.bold("Alertas:")}`);
		console.log(`    ${chalk.red(`${alerts.novo} novo(s)`)} · ${chalk.yellow(`${alerts.acknowledged} em acompanhamento`)} · ${chalk.gray(`${alerts.resolved} resolvido(s)`)}`);
		if (alerts.highSeverity > 0) {
			console.log(`    ${chalk.red.bold(`⚠ ${alerts.highSeverity} alerta(s) de severidade alta`)}`);
		}
		console.log(`    ${chalk.gray("→ Corra `letra health` para detalhes")}`);
	} else {
		console.log(`  ${chalk.gray("Nenhum alerta ativo.")}`);
	}
	console.log();

	if (data.lastUpdated) {
		const idle = data.daysIdle !== null ? `(${data.daysIdle} dia(s) parado)` : "";
		console.log(`  ${chalk.gray(`Última atualização: ${new Date(data.lastUpdated).toLocaleDateString("pt-BR")} ${idle}`)}`);
	}
	if (data.nextItem) {
		console.log(`  ${chalk.gray(`Próximo item na fila: ${data.nextItem.id} · ${data.nextItem.description} (${data.nextItem.stage})`)}`);
	}
	if (focusDiverged) {
		console.log(`  ${chalk.red.bold("⚠ Foco dessincronizado!")} focus.md aponta para spec diferente do item ativo`);
		console.log(`    ${chalk.gray("→ Corra `letra focus <spec>` para corrigir")}`);
	}
	console.log();
}

function runTargetCommand(root: string, label: string, cmdStr: string | null | undefined): string | null {
	if (!cmdStr) return null;
	try {
		const out = execSync(cmdStr, { cwd: root, encoding: "utf-8", timeout: 60000 });
		const lines = out.trim().split("\n").slice(-3).join("\n");
		return `${label}: OK\n${lines}`;
	} catch (e: any) {
		return `${label}: FALHA — ${e.stderr?.slice(0, 200) || e.message?.slice(0, 200) || "erro"}`;
	}
}

export default function () {
	const cmd = new Command("pulse")
		.description("Pulse do workspace — overview de uma olhada só");

	cmd
		.option("--json", "Output in JSON format")
		.option("--build", "Run build command from target config")
		.option("--test", "Run test command from target config")
		.action(async (options: { json?: boolean; build?: boolean; test?: boolean }) => {
			const root = resolve(process.cwd());
			const data = await pulse(root, options);
			if (options.build || options.test) {
				const resolution = resolveWorkspaceRoot(root);
				const workflow = loadWorkflow(resolution.targetDir);
				const location = workflow?.locations?.[0] as
					| { path: string; buildCommand?: string | null; testCommand?: string | null }
					| undefined;
				if (options.build) {
					const result = runTargetCommand(location?.path || root, "Build", location?.buildCommand ?? null);
					if (result) console.log(chalk.gray(result));
				}
				if (options.test) {
					const result = runTargetCommand(location?.path || root, "Test", location?.testCommand ?? null);
					if (result) console.log(chalk.gray(result));
				}
			}
		});

	return cmd;
}
