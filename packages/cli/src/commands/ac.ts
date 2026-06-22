import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";
import { validate } from "./validate.js";
import { generateAdapters } from "../adapters/generate.js";

export function findAcByPattern(lines: string[], acId: string): number | null {
	const normalized = acId.trim();
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!/^- \[ \]/.test(line)) continue;
		const text = line.replace(/^- \[ \]/, "").trim();
		if (text.toLowerCase().includes(normalized.toLowerCase())) return i;
	}
	return null;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listPendingACs(lines: string[]): { lineIdx: number; id: string; text: string }[] {
	const result: { lineIdx: number; id: string; text: string }[] = [];
	const explicit = /^- \[ \] \*\*(AC[\d.]+)\*\*: (.+)$/;
	const plain = /^- \[ \] (.+)$/;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		let match = line.match(explicit);
		if (match) {
			result.push({ lineIdx: i, id: match[1], text: match[2] });
			continue;
		}
		match = line.match(plain);
		if (match) {
			const text = match[1];
			const id = `AC-${i + 1}`;
			result.push({ lineIdx: i, id, text });
		}
	}
	return result;
}

export function markAcById(root: string, acId: string, specName?: string): void {
	const workflow = loadWorkflow(root);

	let spec = specName;
	if (!spec && workflow) {
		const primaryItem = workflow.items.find((i) => i.id === workflow.primaryItemId);
		spec = primaryItem?.spec;
	}

	if (!spec) {
		throw new Error("Spec name required. Use --spec <name> or ensure an active item has a linked spec.");
	}

	const specFile = join(root, ".letra", "specs", spec, "spec.md");
	if (!existsSync(specFile)) {
		throw new Error(`Spec file not found: ${specFile}`);
	}

	const content = readFileSync(specFile, "utf-8");
	const lines = content.split("\n");

	const lineIdx = findAcByPattern(lines, acId);
	if (lineIdx === null) {
		const pendings = listPendingACs(lines);
		const msg = `AC "${acId}" não encontrado ou já marcado como concluído.`;
		if (pendings.length > 0) {
			const pendingStr = pendings.map((ac) => `${ac.id}: ${ac.text}`).join(", ");
			throw new Error(`${msg} Pendentes: ${pendingStr}`);
		}
		throw new Error(msg);
	}

	lines[lineIdx] = lines[lineIdx].replace(/^- \[ \]/, "- [x]");
	writeFileSync(specFile, lines.join("\n"), "utf-8");

	const itemId = workflow?.items.find((i) => i.spec === spec)?.id;
	logEntry(root, "ac_done", `AC ${acId} marcado como concluído em ${spec}`, {
		itemId,
		acId,
		details: { spec },
	});

	console.log(`  ${chalk.green("✓")} AC ${chalk.cyan(acId)} marcado como concluído em ${chalk.cyan(spec)}`);

	try {
		validate(root, { format: "text" });
	} catch {
		// validate may call process.exit — ignore in programmatic use
	}
	if (workflow?.tools && workflow.tools.length > 0) {
		generateAdapters(root, workflow.tools, { source: "flow-ac", quiet: true });
	}
}

function listPendingAction(root: string, specName?: string): void {
	const workflow = loadWorkflow(root);

	let spec = specName;
	if (!spec && workflow) {
		const primaryItem = workflow.items.find((i) => i.id === workflow.primaryItemId);
		spec = primaryItem?.spec;
	}

	if (!spec) {
		console.log(chalk.yellow("Nenhum spec ativo. Use --spec <name> ou tenha um item ativo com spec vinculada."));
		return;
	}

	const specFile = join(root, ".letra", "specs", spec, "spec.md");
	if (!existsSync(specFile)) {
		console.log(chalk.red(`Spec file not found: ${specFile}`));
		return;
	}

	const content = readFileSync(specFile, "utf-8");
	const lines = content.split("\n");
	const pendings = listPendingACs(lines);

	if (pendings.length === 0) {
		console.log(chalk.green(`✅ Todos os ACs em "${spec}" estão concluídos!`));
	} else {
		console.log(chalk.yellow(`\nACs pendentes em "${chalk.cyan(spec)}":`));
		for (const ac of pendings) {
			console.log(`  ${chalk.red("✗")} ${chalk.cyan(ac.id)}: ${ac.text}`);
		}
		console.log(chalk.dim(`\nPara marcar um AC: letra ac done <AC-ID>`));
	}
}

export default function acCommand() {
	const cmd = new Command("ac")
		.description("Gerenciar Acceptance Criteria — marcar como concluído e listar pendentes");

	cmd
		.command("done <ac-id>")
		.option("--spec <name>", "Nome do spec (padrão: spec do item ativo)")
		.description("Marcar um AC como concluído no spec.md")
		.action((acId: string, options: { spec?: string }) => {
			const root = resolve(process.cwd());
			markAcById(root, acId, options.spec);
		});

	cmd
		.command("list")
		.option("--spec <name>", "Nome do spec (padrão: spec do item ativo)")
		.description("Listar ACs pendentes de um spec")
		.action((options: { spec?: string }) => {
			const root = resolve(process.cwd());
			listPendingAction(root, options.spec);
		});

	cmd.action(() => {
		const root = resolve(process.cwd());
		listPendingAction(root);
	});

	return cmd;
}
