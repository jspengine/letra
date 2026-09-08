import { resolve } from "node:path";
import { Command, Option } from "commander";
import { activityOperation } from "../domain-operations/service.js";

function collectEvidence(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export default function operationCommand(): Command {
	const command = new Command("operation").description(
		"Execute controlled harness operations with structured JSON results",
	);

	command
		.command("event <item-id>")
		.requiredOption("--status <status>", "started, heartbeat, succeeded ou failed")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.option("--actor <actor>", "Identidade do actor", "agent:codex")
		.option("--message <message>", "Mensagem do evento")
		.option("--recovery <recovery>", "retry, release, handoff ou human")
		.option("--error-code <code>", "Código da falha")
		.action(async (itemId: string, options: { status: "started" | "heartbeat" | "succeeded" | "failed"; executor: string; expectedRevision: string; reason: string; actor: string; message?: string; recovery?: "retry" | "release" | "handoff" | "human"; errorCode?: string }) => {
			const { recordExecutionEvent } = await import("../domain-operations/service.js");
			printJson(await recordExecutionEvent(resolve(process.cwd()), { itemId, status: options.status, executorId: options.executor, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, message: options.message, recovery: options.recovery, errorCode: options.errorCode }));
		});

	command
		.command("claim <item-id>")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--capability <capability>", "Capability usada")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.option("--actor <actor>", "Identidade do actor", "agent:codex")
		.option("--ttl <minutes>", "TTL do claim em minutos", (value) => Number(value), 30)
		.action(async (itemId: string, options: { executor: string; capability: string; expectedRevision: string; reason: string; actor: string; ttl: number }) => {
			const { claimOperation } = await import("../domain-operations/service.js");
			printJson(await claimOperation(resolve(process.cwd()), { itemId, executorId: options.executor, capability: options.capability, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, ttlMinutes: options.ttl }));
		});

	command
		.command("validate")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.action(async (options: { expectedRevision: string; reason: string }) => {
			const { runValidationOperation } = await import("../domain-operations/service.js");
			printJson(await runValidationOperation(resolve(process.cwd()), options));
		});
	command.command("activity [item-id]").action((itemId?: string) => printJson(activityOperation(resolve(process.cwd()), itemId)));
	command.command("evidence <item-id>")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason")
		.requiredOption("--kind <kind>", "diff, file, command, test ou artifact")
		.requiredOption("--value <value>", "Valor/path")
		.requiredOption("--source <source>", "Origem observada")
		.option("--actor <actor>", "Actor", "agent:codex")
		.action(async (itemId: string, options: { executor: string; expectedRevision: string; reason: string; kind: "diff" | "file" | "command" | "test" | "artifact"; value: string; source: string; actor: string }) => {
			const { submitEvidenceOperation } = await import("../domain-operations/service.js");
			printJson(await submitEvidenceOperation(resolve(process.cwd()), { itemId, executorId: options.executor, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, evidence: [{ kind: options.kind, value: options.value, source: options.source }] }));
		});
	command.command("handoff <item-id>")
		.requiredOption("--to <actor>", "Destino")
		.requiredOption("--executor <executor-id>", "Executor")
		.requiredOption("--summary <summary>", "Resumo")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason")
		.option("--actor <actor>", "Actor", "agent:codex")
		.action(async (itemId: string, options: { to: string; executor: string; summary: string; expectedRevision: string; reason: string; actor: string }) => {
			const { requestHandoffOperation } = await import("../domain-operations/service.js");
			printJson(await requestHandoffOperation(resolve(process.cwd()), { itemId, to: options.to, executorId: options.executor, summary: options.summary, evidence: [], expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor }));
		});

	command
		.command("complete-ac <ac-id>")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for completing the criterion")
		.addOption(
			new Option("--evidence <evidence>", "Regression evidence")
				.argParser(collectEvidence)
				.default([]),
		)
		.action(
			async (
				acId: string,
				options: {
					expectedRevision: string;
					reason: string;
					evidence: string[];
				},
			) => {
				const { completeAcOperation } = await import("../domain-operations/service.js");
				printJson(completeAcOperation(resolve(process.cwd()), { acId, ...options }));
			},
		);

	command
		.command("request-transition <item-id>")
		.requiredOption("--to <stage-id>", "Target stage ID")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for requesting the transition")
		.action(
			async (
				itemId: string,
				options: {
					to: string;
					expectedRevision: string;
					reason: string;
				},
			) => {
				const { requestTransitionOperation } = await import(
					"../domain-operations/service.js"
				);
				printJson(
					await requestTransitionOperation(resolve(process.cwd()), {
						itemId,
						targetStageId: options.to,
						expectedRevision: options.expectedRevision,
						reason: options.reason,
					}),
				);
			},
		);

	return command;
}
