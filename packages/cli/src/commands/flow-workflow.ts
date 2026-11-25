import chalk from "chalk";
import { join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import {
	createWorkflowDefinition,
	createWorkflowDraft,
	getActiveWorkflowVersion,
	getWorkflowDraft,
	getWorkflowVersion,
	listWorkflowDefinitions,
	listWorkflowDraftRevisions,
	listWorkflowVersions,
	publishWorkflowDraft,
	rollbackWorkflowVersion,
	updateWorkflowDraft,
	validateWorkflowContent,
	type WorkflowDefinitionContent,
} from "../workflow-versions/service.js";
import { loadHarness, resolveHarnessRoot } from "../harness/loader.js";
import { signLocalOperation } from "../identity/signing.js";

function section(title: string): void {
	console.log(`\n${chalk.bold(title)}`);
	console.log("─".repeat(40));
}

function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

/**
 * Lista todas as definições de workflow do workspace.
 */
export function workflowListCommands(root: string): void {
	const definitions = listWorkflowDefinitions(root);
	if (definitions.length === 0) {
		console.log(chalk.yellow("Nenhuma definição de workflow encontrada."));
		return;
	}
	section("Workflow Definitions");
	for (const def of definitions) {
		const active = def.activeVersionId ? chalk.green("● ativo") : chalk.gray("○ sem publicação");
		console.log(`  ${chalk.cyan(def.id)}  ${chalk.bold(def.name)}  (${def.nextVersionNumber} versões) ${active}`);
	}
}

/**
 * Mostra detalhes de uma definição de workflow.
 */
export function workflowShowCommand(root: string, workflowId: string): void {
	const definitions = listWorkflowDefinitions(root);
	const def = definitions.find((d) => d.id === workflowId);
	if (!def) {
		console.log(chalk.red(`Definição "${workflowId}" não encontrada.`));
		return;
	}
	const versions = listWorkflowVersions(root, workflowId);
	const active = getActiveWorkflowVersion(root, workflowId);
	section(`Workflow: ${def.name}`);
	console.log(`  ID:               ${def.id}`);
	console.log(`  Next version:     ${def.nextVersionNumber}`);
	console.log(`  Total versions:   ${versions.length}`);
	console.log(`  Active version:   ${active ? active.number : "none"}`);
	console.log(`  Created:          ${def.createdAt}`);
	console.log(`  Updated:          ${def.updatedAt}`);
}

/**
 * Cria um rascunho de edição para um workflow.
 */
export function workflowDraftCommand(root: string, workflowId: string, actor: string, basedOnVersionNumber?: number): void {
	try {
		const draft = createWorkflowDraft(root, workflowId, actor, basedOnVersionNumber);
		section("Draft created");
		console.log(`  Workflow: ${workflowId}`);
		console.log(`  Revision: ${draft.revision}`);
		console.log(`  Number:   ${draft.number ?? "(draft)"}`);
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}

/**
 * Atualiza o conteúdo de um rascunho.
 */
export function workflowUpdateDraftCommand(
	root: string,
	workflowId: string,
	actor: string,
	expectedRevision: number,
	content: unknown,
	changeSummary?: string,
): void {
	try {
		const draft = updateWorkflowDraft(root, workflowId, {
			actor,
			expectedRevision,
			content: content as Parameters<typeof updateWorkflowDraft>[2]["content"],
			changeSummary,
		});
		section("Draft updated");
		console.log(`  Revision: ${draft.revision}`);
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}

/**
 * Valida o conteúdo de um rascunho.
 */
export function workflowValidateCommand(root: string, workflowId: string): void {
	const draft = getWorkflowDraft(root, workflowId);
	const result = validateWorkflowContent(draft.content);
	if (result.valid) {
		console.log(chalk.green("✓ Workflow válido"));
	} else {
		section("Validation errors");
		for (const err of result.errors) {
			console.log(`  ${chalk.red("✗")} ${err.message} ${chalk.gray(`(${err.code})`)}`);
		}
	}
}

/**
 * Publica um rascunho como nova versão.
 */
export function workflowPublishCommand(root: string, workflowId: string, actor: string, expectedRevision: number, reason: string): void {
	try {
		const published = publishWorkflowDraft(root, workflowId, { expectedRevision, actor, reason });
		section("Workflow published");
		console.log(`  Version:  ${published.number}`);
		console.log(`  ID:       ${published.id}`);
		console.log(`  Actor:    ${published.publishedBy}`);
		console.log(`  Hash:     ${published.contentHash}`);
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}

/**
 * Faz rollback para uma versão anterior (publica nova versão derivada).
 */
export function workflowRollbackCommand(root: string, workflowId: string, actor: string, versionNumber: number, reason: string): void {
	try {
		const proof = signLocalOperation(root, actor, "workflow.rollback", { workflowId, versionNumber, reason });
		const restored = rollbackWorkflowVersion(root, workflowId, { versionNumber, actor, reason, proof });
		section("Workflow rolled back");
		console.log(`  New version:   ${restored.number}`);
		console.log(`  Restored from: ${restored.restoredFromVersionId}`);
		console.log(`  Actor:         ${actor}`);
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}

/**
 * Lista todas as versões publicadas de um workflow.
 */
export function workflowVersionsCommand(root: string, workflowId: string): void {
	const versions = listWorkflowVersions(root, workflowId);
	if (versions.length === 0) {
		console.log(chalk.yellow("Nenhuma versão publicada."));
		return;
	}
	section(`Versions of ${workflowId}`);
	for (const v of versions) {
		const status = v.status === "published" ? chalk.green("●") : chalk.gray("○");
		console.log(
			`  ${status} v${v.number}  ${chalk.gray(v.publishedAt ?? "")}  ${v.publishedBy ?? ""}  ${v.changeSummary ?? ""}`,
		);
	}
}

/**
 * Lista revisões de rascunho.
 */
export function workflowDraftRevisionsCommand(root: string, workflowId: string): void {
	const revisions = listWorkflowDraftRevisions(root, workflowId);
	if (revisions.length === 0) {
		console.log(chalk.yellow("Nenhuma revisão de rascunho."));
		return;
	}
	section(`Draft revisions of ${workflowId}`);
	for (const r of revisions) {
		console.log(`  r${r.revision}  ${r.changeSummary ?? "(sem resumo)"}`);
	}
}

/**
 * Cria/atualiza workflow a partir de template.
 */
export function workflowTemplateCommand(
	root: string,
	workflowId: string,
	actor: string,
	template: string,
	options: { name?: string; stages?: string[]; tools?: string[] },
): void {
	try {
		const name = options.name ?? template;
		let content: WorkflowDefinitionContent;
		if (options.stages) {
			content = {
				name,
				stages: options.stages.map((id, index) => ({ id, name: id, order: index })),
				...(options.tools && { tools: options.tools }),
			};
		} else {
			if (!template.trim()) throw new Error("Informe o template com --template <nome>.");
			const available = Object.keys(loadHarness(resolveHarnessRoot(root))?.flows ?? {});
			if (!available.includes(template)) {
				const known = available.length > 0 ? available.join(", ") : "nenhum (harness indisponível)";
				throw new Error(`Template "${template}" não existe no harness. Disponíveis: ${known}.`);
			}
			// No `stages` on purpose: the board editor offers to copy the template's
			// stages, connections, gates and rules only for drafts shaped like this.
			content = {
				name,
				template,
				...(options.tools && { tools: options.tools }),
			} as unknown as WorkflowDefinitionContent;
		}
		const result = createWorkflowDefinition(root, { name, actor, content });
		console.log(chalk.green(`✓ Workflow criado: ${result.definition.id}`));
		console.log(`  Draft: ${result.draft.revision}`);
		if (!options.stages) {
			console.log(
				`  Próximo passo: no board, abra Configurações → Fluxo, use "Usar estágios como ponto de partida", valide e publique.`,
			);
		}
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
		process.exitCode = 1;
	}
}

/**
 * Lista ou atualiza adapters do workflow.
 */
export function workflowAdaptersCommand(
	root: string,
	workflowId: string,
	options: { tools?: string; list?: boolean },
): void {
	try {
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));

		if (options.list || !options.tools) {
			console.log(chalk.bold(`Adapters ativos: ${workflow.tools?.join(", ") ?? "nenhum"}`));
			return;
		}

		workflow.tools = options.tools.split(",").map((t: string) => t.trim());
		workflow.updatedAt = new Date().toISOString();
		writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
		console.log(chalk.green(`✓ Adapters atualizados: ${workflow.tools.join(", ")}`));
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}

/**
 * Lista locations do workflow.
 */
export function workflowLocationsCommand(
	root: string,
	workflowId: string,
	options: { add?: string; remove?: string; list?: boolean },
): void {
	try {
		const workflowPath = join(root, ".letra", "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));

		if (options.list || (!options.add && !options.remove)) {
			const locations = workflow.locations ?? [];
			if (locations.length === 0) {
				console.log(chalk.yellow("Nenhuma location configurada."));
				return;
			}
			console.log(chalk.bold(`Locations (${locations.length}):`));
			for (const loc of locations) {
				console.log(`  ${loc.id ?? loc.path} — ${loc.label ?? loc.path}`);
			}
			return;
		}

		if (!workflow.locations) workflow.locations = [];

		if (options.add) {
			workflow.locations.push({ id: `${workflow.locations.length + 1}`, path: options.add, label: options.add });
			workflow.updatedAt = new Date().toISOString();
			writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
			console.log(chalk.green(`✓ Location adicionada: ${options.add}`));
		}

		if (options.remove) {
			workflow.locations = workflow.locations.filter((l: any) => l.id !== options.remove && l.path !== options.remove);
			workflow.updatedAt = new Date().toISOString();
			writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
			console.log(chalk.green(`✓ Location removida: ${options.remove}`));
		}
	} catch (error) {
		console.log(chalk.red(`Erro: ${(error as Error).message}`));
	}
}
