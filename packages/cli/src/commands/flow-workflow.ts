import chalk from "chalk";
import { resolve } from "node:path";
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
} from "../workflow-versions/service.js";

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
		const restored = rollbackWorkflowVersion(root, workflowId, { versionNumber, actor, reason });
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
