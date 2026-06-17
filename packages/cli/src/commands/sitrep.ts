import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import type { Item, Workflow } from "./flow-init.js";
import { loadHealthRecord, getSummary } from "../health-record.js";
import { logEntry } from "../session-log.js";

const START_MARKER = "<!-- sitrep:start -->";
const END_MARKER = "<!-- sitrep:end -->";

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
	const dir = join(root, ".letra", "decisions");
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
	const specDir = join(root, ".letra", "specs", specName);
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
		.filter((s) => s.zone === "doing" || (!s.zone && s.order > 0 && s.order < workflow.stages.length - 1))
		.map((s) => s.id);
	const stageSet = new Set(activeStages);
	if (stageSet.size === 0) {
		const mid = Math.floor(workflow.stages.length / 2);
		const stage = workflow.stages[mid];
		if (stage) stageSet.add(stage.id);
	}
	const items = workflow.items.filter((i) => stageSet.has(i.stage));
	if (items.length === 0) return null;
	return items.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

function getStageName(stageId: string, workflow?: Workflow | null): string {
	if (!workflow) return stageId;
	return workflow.stages?.find((s) => s.id === stageId)?.name ?? stageId;
}

function extractSection(content: string, heading: string): string | null {
	const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`## ${esc}\\s+([\\s\\S]*?)(?=\\n## |\\n*$)`);
	const match = content.match(regex);
	return match ? match[1].trim() : null;
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

function rewriteContextFile(
	content: string,
	dynamicBlock: string,
	stack: string | null,
	restricoes: string | null,
	porques: string | null,
): string {
	const headerMatch = content.match(/^# Context[\s\S]*?(?=\n## )/);
	const header = headerMatch ? headerMatch[0].trim() : "# Context";

	const intent = extractSection(content, "Intent");
	const dominio = extractSection(content, "Domínio");

	// Preserve content after <!-- sitrep:ignore -->
	const ignoreIdx = content.indexOf("<!-- sitrep:ignore -->");
	let ignoredContent = "";
	if (ignoreIdx !== -1) {
		ignoredContent = content.slice(ignoreIdx);
	}

	const sections: string[] = [header];

	if (intent) {
		sections.push(`## Intent\n\n${intent}`);
	}

	if (dominio) {
		sections.push(`## Domínio\n\n${dominio}`);
	}

	sections.push(`${START_MARKER}\n${dynamicBlock}\n${END_MARKER}`);

	if (stack) {
		sections.push(`## Stack\n\n${stack}`);
	}

	if (restricoes) {
		sections.push(`## Restrições Reais\n\n${restricoes}`);
	}

	if (porques) {
		sections.push(`## Porquês\n\n${porques}`);
	}

	let result = sections.join("\n\n") + "\n";

	if (ignoredContent) {
		result += `\n${ignoredContent}\n`;
	}

	return result;
}

function showDiff(original: string, modified: string): void {
	const origLines = original.split("\n");
	const modLines = modified.split("\n");
	const maxLen = Math.max(origLines.length, modLines.length);

	for (let i = 0; i < maxLen; i++) {
		const o = origLines[i] ?? "";
		const m = modLines[i] ?? "";
		if (o !== m) {
			if (i < origLines.length) {
				console.log(chalk.red(`- ${o}`));
			}
			if (i < modLines.length) {
				console.log(chalk.green(`+ ${m}`));
			}
		}
	}
}

function logChanges(original: string, modified: string): void {
	if (original === modified) {
		console.log(chalk.gray("  Nenhuma alteração necessária."));
		return;
	}

	const sections: string[] = [];
	if (original.match(/^> Updated:.*$/m) !== modified.match(/^> Updated:.*$/m)) {
		sections.push("Updated");
	}

	const origHasSitrep = original.includes(START_MARKER);
	const modHasSitrep = modified.includes(START_MARKER);
	if (origHasSitrep !== modHasSitrep) {
		sections.push(modHasSitrep ? "Bloco sitrep (inserido)" : "Bloco sitrep (removido)");
	} else if (origHasSitrep) {
		sections.push("Bloco sitrep (atualizado)");
	}

	if (sections.length > 0) {
		console.log(chalk.gray(`  Seções alteradas: ${sections.join(", ")}`));
	} else {
		console.log(chalk.gray("  Apenas data atualizada."));
	}
}

export async function sitrep(
	rootPath: string,
	options?: { dryRun?: boolean; quiet?: boolean; skipLog?: boolean },
): Promise<void> {
	const contextFile = join(rootPath, ".letra", "context.md");
	if (!existsSync(contextFile)) {
		if (!options?.quiet) console.log(chalk.yellow("Aviso: .letra/context.md não encontrado"));
		return;
	}

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
	const originalContent = readFileSync(contextFile, "utf-8");

	// Extract manual sections for preservation
	const stack = extractSection(originalContent, "Stack");
	const restricoes = extractSection(originalContent, "Restrições Reais");
	const porques = extractSection(originalContent, "Porquês");

	const withUpdated = originalContent.replace(
		/^(> Updated:).*$/m,
		`$1 ${new Date().toISOString()}`,
	);

	const newContent = rewriteContextFile(withUpdated, dynamicBlock, stack, restricoes, porques);

	if (options?.dryRun) {
		console.log(chalk.bold("\n📋 Simulação de atualização — dry-run\n"));
		showDiff(originalContent, newContent);
		return;
	}

	writeFileSync(contextFile, newContent, "utf-8");
	if (!options?.quiet) {
		console.log(chalk.green("✓ Situação atualizada em .letra/context.md"));
		logChanges(originalContent, newContent);
	}

	if (!options?.skipLog) {
		logEntry(rootPath, "sitrep", "context.md atualizado com estado do workspace", {
			details: {
				hasItem: !!currentItem,
				itemId: currentItem?.id,
				alertsNovo: alertSummary.novo,
			},
		});
	}
}

export default function () {
	const cmd = new Command("sitrep")
		.description("Atualizar .letra/context.md com estado real do workspace");

	cmd
		.option("--dry-run", "Exibir diff sem modificar o arquivo")
		.action(async (options: { dryRun?: boolean }) => {
			const root = resolve(process.cwd());
			await sitrep(root, options);
		});

	return cmd;
}
