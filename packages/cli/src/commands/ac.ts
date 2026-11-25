import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";
import { validate } from "./validate.js";
import { generateAdapters } from "../adapters/generate.js";
import { getLetraDir } from "./../workspace/resolver.js";
import { completeAcOperation } from "../domain-operations/service.js";
import { resolveAgentDirection } from "../agent-direction/service.js";

function explicitItemDirection(root: string, itemId?: string): ReturnType<typeof resolveAgentDirection> {
	if (!itemId) throw new Error("Item alvo explícito obrigatório (--item ITEM-ID) quando não há Run selecionada.");
	return resolveAgentDirection(root, itemId);
}

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

function collectEvidence(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function listPendingACs(lines: string[]): { lineIdx: number; id: string; text: string }[] {
	const result: { lineIdx: number; id: string; text: string }[] = [];
	const explicit = /^- \[ \] \*\*(AC(?:-gap-)?[\d.]+)(?:\s*[—-][^*]*)?\*\*:?\s*(.*)$/i;
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
			const identified = text.match(/^\*\*(AC(?:-gap-)?[\d.]+)(?:\s*[—-][^*]*)?\*\*:?\s*(.*)$/i)
				?? text.match(/^(AC(?:-gap-)?[\d.]+)\s*:?\s*(.*)$/i);
			if (identified) result.push({ lineIdx: i, id: identified[1], text: identified[2] });
		}
	}
	return result;
}

export function markAcById(root: string, acId: string, specName?: string, itemId?: string): void {
	const workflow = loadWorkflow(root);

	let spec = specName;
	if (!spec && workflow) {
		spec = explicitItemDirection(root, itemId).item?.spec ?? undefined;
	}

	if (!spec) {
		throw new Error(
			"Spec name required. Use --spec <name> or ensure an active item has a linked spec.",
		);
	}

	const specFile = join(getLetraDir(root), "specs", spec, "spec.md");
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

	const linkedItemId = workflow?.items.find((i) => i.spec === spec)?.id;
	logEntry(root, "ac_done", `AC ${acId} marcado como concluído em ${spec}`, {
		itemId: linkedItemId,
		acId,
		details: { spec },
	});

	console.log(
		`  ${chalk.green("✓")} AC ${chalk.cyan(acId)} marcado como concluído em ${chalk.cyan(spec)}`,
	);

	try {
		validate(root, { format: "text" });
	} catch {
		// validate may call process.exit — ignore in programmatic use
	}
	if (workflow?.tools && workflow.tools.length > 0) {
		generateAdapters(root, workflow.tools, { source: "flow-ac", quiet: true });
	}
}

function listPendingAction(root: string, specName?: string, itemId?: string): void {
	const workflow = loadWorkflow(root);

	let spec = specName;
	if (!spec && workflow) {
		spec = explicitItemDirection(root, itemId).item?.spec ?? undefined;
	}

	if (!spec) {
		console.log(
			chalk.yellow(
				"Nenhum spec ativo. Use --spec <name> ou tenha um item ativo com spec vinculada.",
			),
		);
		return;
	}

	const specFile = join(getLetraDir(root), "specs", spec, "spec.md");
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
		console.log(chalk.dim("\nPara marcar um AC: letra ac done <AC-ID> --item <ITEM-ID>"));
	}
}

export default function acCommand() {
	const cmd = new Command("ac").description(
		"Gerenciar Acceptance Criteria — marcar como concluído e listar pendentes",
	);

	cmd.command("done <ac-id>")
		.requiredOption("--item <item-id>", "Item alvo explícito (ex.: ITEM-98)")
		.option("--spec <name>", "Nome do spec (padrão: spec do item informado)")
		.requiredOption("--expected-revision <revision>", "Revision retornada por letra direction")
		.requiredOption("--reason <reason>", "Motivo da conclusão")
		.requiredOption("--evidence <evidence>", "Evidência verificável; pode ser repetido", collectEvidence, [])
		.requiredOption("--executor <executor-id>", "Executor que produziu a evidência")
		.option("--actor <actor>", "Identidade do actor que possui o claim", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.description("Concluir um AC pela operação canônica do harness")
		.action((acId: string, options: { item: string; spec?: string; expectedRevision: string; reason: string; evidence: string[]; executor: string; actor: string; idempotencyKey?: string }) => {
			const root = resolve(process.cwd());
			const result = completeAcOperation(root, {
				acId,
				itemId: options.item,
				expectedRevision: options.expectedRevision,
				reason: options.reason,
				evidence: options.evidence,
				executorId: options.executor,
				actor: options.actor,
				idempotencyKey: options.idempotencyKey,
			});
			if (result.outcome !== "accepted") throw new Error(`${result.reasonCode}: ${result.reason}`);
			console.log(JSON.stringify(result, null, 2));
		});

	cmd.command("list")
			.option("--spec <name>", "Nome do spec (padrão: spec do item ativo)")
			.option("--item <item-id>", "Item alvo quando não há Run selecionada")
			.option("--json", "Saída em JSON")
			.description("Listar ACs pendentes de um spec")
			.action((options: { spec?: string; json?: boolean; item?: string }) => {
				const root = resolve(process.cwd());
				if (options.json) {
					const workflow = loadWorkflow(root);
					let spec = options.spec;
					if (!spec && workflow) {
						spec = explicitItemDirection(root, options.item).item?.spec ?? undefined;
					}
					if (!spec) {
						console.log(JSON.stringify({ error: "Nenhum spec ativo." }, null, 2));
						return;
					}
					const specFile = join(getLetraDir(root), "specs", spec, "spec.md");
					if (!existsSync(specFile)) {
						console.log(JSON.stringify({ error: `Spec file not found: ${specFile}` }, null, 2));
						return;
					}
					const content = readFileSync(specFile, "utf-8");
					const lines = content.split("\n");
					const pendings = listPendingACs(lines);
					console.log(JSON.stringify({ spec, pending: pendings }, null, 2));
					return;
				}
				listPendingAction(root, options.spec, options.item);
			});

	cmd.action(() => {
		const root = resolve(process.cwd());
		listPendingAction(root);
	});

	return cmd;
}
