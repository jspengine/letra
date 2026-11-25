import { resolve } from "node:path";
import { Command } from "commander";
import { printJson } from "./operation.js";
import { directionForOperation, runSecurityReviewOperation } from "../domain-operations/service.js";

export default function securityCommand(): Command {
	const command = new Command("security").description("Executar revisão de Security escopada por item");
	command
		.command("review <item-id>")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.option("--actor <actor>", "Identidade do actor", "security")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { executor: string; expectedRevision: string; reason: string; actor: string; idempotencyKey?: string }) => {
			const root = resolve(process.cwd());
			// The item direction the operation compares (ITEM-39), not the workspace one.
			const currentRevision = directionForOperation(root, { itemId }).revision;
			const result = await runSecurityReviewOperation(root, {
				itemId,
				executorId: options.executor,
				expectedRevision: options.expectedRevision || currentRevision,
				reason: options.reason,
				actor: options.actor,
				idempotencyKey: options.idempotencyKey,
			});
			// Same contract as `letra operation`: a refused review (blocking
			// findings, missing claim, no workflow) exits 1 (ITEM-25).
			printJson(result);
		});
	return command;
}
