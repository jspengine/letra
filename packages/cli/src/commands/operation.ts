import { resolve } from "node:path";
import { Command, Option } from "commander";

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
