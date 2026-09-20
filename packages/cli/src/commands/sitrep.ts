import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import type { Item, Workflow } from "./flow-init.js";
import { loadHealthRecord, getSummary } from "../health-record.js";
import { logEntry } from "../session-log.js";
import { resolveWorkspaceRoot } from "../workspace/resolver.js";
import { getLetraDir } from "./../workspace/resolver.js";

const DEPRECATION_MESSAGE =
	"`letra sitrep` não atualiza mais context.md. Use `letra direction --json` para estado vivo; edite context.md apenas como memória humana curada.";

interface DecisionInfo {
	title: string;
	date: string;
}

interface SitrepData {
	stage: string;
	currentItem: Item | null;
	acCounts: { pending: number; total: number } | null;
	alertSummary: ReturnType<typeof getSummary>;
	decisions: DecisionInfo[];
	workflow: Workflow | null;
	stack?: string;
	restricoes?: string;
	porques?: string;
}

function getRecentDecisions(root: string, max: number): DecisionInfo[] {
	const dir = join(getLetraDir(root), "decisions");
	if (!existsSync(dir)) return [];
	try {
		const files = readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((f) => ({
				name: f,
				mtime: statSync(join(dir, f)).mtimeMs,
			}))
			.sort((a, b) => b.mtime - a.mtime)
			.slice(0, max);

		return files.map((f) => ({
			title: f.name.replace(/\.md$/, "").replace(/-/g, " "),
			date: new Date(f.mtime).toLocaleDateString("pt-BR"),
		}));
	} catch {
		return [];
	}
}

function countItemACs(root: string, specName: string): { pending: number; total: number } {
	const specDir = join(getLetraDir(root), "specs", specName);
	const acceptanceFile = join(specDir, "acceptance.md");
	const specFile = join(specDir, "spec.md");

	const countInText = (text: string) => {
		const pending = (text.match(/-\s*\[ \]\s*\*\*(.+?)\*\*/g) || []).length;
		const done = (text.match(/-\s*\[[xX]\]\s*\*\*(.+?)\*\*/g) || []).length;
		return { pending, total: pending + done };
	};

	if (existsSync(acceptanceFile)) {
		return countInText(readFileSync(acceptanceFile, "utf-8"));
	}
	if (existsSync(specFile)) {
		const content = readFileSync(specFile, "utf-8");
		const match = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/);
		return match ? countInText(match[1]) : { pending: 0, total: 0 };
	}
	return { pending: 0, total: 0 };
}

function findCurrentItem(workflow: Workflow): Item | null {
	const activeStages = workflow.stages
		.filter(
			(s) =>
				s.zone === "doing" ||
				(!s.zone && s.order > 0 && s.order < workflow.stages.length - 1),
		)
		.map((s) => s.id);
	const stageSet = new Set(activeStages);
	if (stageSet.size === 0) {
		const mid = Math.floor(workflow.stages.length / 2);
		const stage = workflow.stages[mid];
		if (stage) stageSet.add(stage.id);
	}
	const items = workflow.items.filter((i) => stageSet.has(i.stage));
	if (items.length === 0) return null;
	return items.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
}

function getStageName(stageId: string, workflow?: Workflow | null): string {
	if (!workflow) return stageId;
	return workflow.stages?.find((s) => s.id === stageId)?.name ?? stageId;
}

function buildSitrepBlock(data: SitrepData): string {
	const lines: string[] = [];

	// Estágio
	if (data.currentItem) {
		lines.push(`**Estágio**: ${getStageName(data.currentItem.stage, data.workflow)}`);
		const item = data.currentItem;
		let itemLine = `**Item atual**: ${item.id} — ${item.description}`;
		if (item.spec) itemLine += ` (spec: ${item.spec})`;
		lines.push(itemLine);
		if (data.acCounts) {
			const { pending, total } = data.acCounts;
			const done = total - pending;
			lines.push(`**ACs**: ${pending}/${total} pendentes | ${done} feito(s)`);
		}
	} else if (data.workflow) {
		lines.push("**Estágio**: sem item ativo");
	} else {
		lines.push("**Estágio**: sem workflow definido");
	}

	// Alertas
	const s = data.alertSummary;
	const alertParts: string[] = [];
	if (s.novo > 0) alertParts.push(`${s.novo} novo(s)`);
	if (s.ciente > 0) alertParts.push(`${s.ciente} em acompanhamento`);
	if (s.resolvido > 0) alertParts.push(`${s.resolvido} resolvido(s)`);
	lines.push(`**Alertas**: ${alertParts.length > 0 ? alertParts.join(" · ") : "0 alertas"}`);
	if (s.alta > 0) {
		lines.push(`⚠ ${s.alta} alerta(s) de severidade alta`);
	}

	// Decisões recentes
	if (data.decisions.length > 0) {
		const decStr = data.decisions.map((d) => `"${d.title}" (${d.date})`).join(", ");
		lines.push(`**Últimas decisões**: ${decStr}`);
	}

	return lines.join("\n");
}

export async function sitrep(
	rootPath: string,
	options?: { dryRun?: boolean; quiet?: boolean; skipLog?: boolean },
): Promise<void> {
	const workflow = loadWorkflow(rootPath);
	const healthRecord = loadHealthRecord(rootPath);
	const alertSummary = getSummary(healthRecord);

	let currentItem: Item | null = null;
	let acCounts: { pending: number; total: number } | null = null;
	if (workflow) {
		currentItem = findCurrentItem(workflow);
		if (currentItem?.spec) {
			acCounts = countItemACs(rootPath, currentItem.spec);
		}
	}

	const decisions = getRecentDecisions(rootPath, 4);

	const data: SitrepData = {
		stage: currentItem?.stage ?? "sem item ativo",
		currentItem,
		acCounts,
		alertSummary,
		decisions,
		workflow,
	};

	const dynamicBlock = buildSitrepBlock(data);

	if (!options?.quiet) {
		console.log(chalk.yellow(DEPRECATION_MESSAGE));
		console.log(chalk.bold("\nResumo vivo atual\n"));
		console.log(dynamicBlock);
	}

	if (!options?.skipLog) {
		logEntry(rootPath, "sitrep", "sitrep consultado sem atualizar context.md", {
			details: {
				hasItem: !!currentItem,
				itemId: currentItem?.id,
				alertsNovo: alertSummary.novo,
			},
		});
	}
}

export default function () {
	const cmd = new Command("sitrep").description(
		"Compatibilidade: imprimir resumo vivo; não atualiza context.md",
	);

	cmd.option("--dry-run", "Exibir diff sem modificar o arquivo").action(
		async (options: { dryRun?: boolean }) => {
			const resolution = resolveWorkspaceRoot(process.cwd());
			await sitrep(resolution.workspaceRoot, options);
		},
	);

	return cmd;
}
