import { resolve } from "node:path";
import { Command } from "commander";
import { loadWorkflow } from "./flow-init.js";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { runSecurityReviewOperation } from "../domain-operations/service.js";

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
			const workflow = loadWorkflow(root);
			const currentRevision = resolveAgentDirection(root).revision;
			const result = await runSecurityReviewOperation(root, {
				itemId,
				executorId: options.executor,
				expectedRevision: options.expectedRevision || currentRevision,
				reason: options.reason,
				actor: options.actor,
				idempotencyKey: options.idempotencyKey,
			});
			process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
			if (result.outcome === "rejected" && workflow) process.exitCode = 1;
		});
	return command;
}
