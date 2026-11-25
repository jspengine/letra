import { resolve } from "node:path";
import { Command, Option } from "commander";
import { resolveLocalIdentity } from "../identity/service.js";
import { activityOperation, migrateRunWorkflowOperation } from "../domain-operations/service.js";
import { signLocalOperation } from "../identity/signing.js";

function collectEvidence(value: string, previous: string[]): string[] {
	return [...previous, value];
}

/**
 * Prints the operation result and mirrors its outcome in the exit code
 * (ITEM-25): a refused operation exits 1 so scripts and agents do not read it
 * as success. "approval-required" is an accepted request waiting for a human,
 * not a refusal, and keeps 0; read-only payloads (activity) have no outcome.
 */
export function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
	if (isRejected(value)) process.exitCode = 1;
}

function isRejected(value: unknown): boolean {
	return typeof value === "object" && value !== null && (value as { outcome?: unknown }).outcome === "rejected";
}

export default function operationCommand(): Command {
	const command = new Command("operation").description(
		"Execute controlled harness operations with structured JSON results",
	);

	command.command("run-migrate-workflow <run-id>")
		.requiredOption("--to-version <version-id>", "Published workflow version ID")
		.requiredOption("--to-stage <stage-id>", "Destination stage ID")
		.requiredOption("--run-revision <revision>", "Expected Run revision", (value) => Number(value))
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Audited migration reason")
		.action((runId: string, options: { toVersion: string; toStage: string; runRevision: number; expectedRevision: string; reason: string }) => {
			const root = resolve(process.cwd());
			const actor = resolveLocalIdentity(root).id;
			const details = { runId, toWorkflowVersionId: options.toVersion, toStageId: options.toStage, expectedRunRevision: options.runRevision, expectedDirectionRevision: options.expectedRevision, reason: options.reason };
			const proof = signLocalOperation(root, actor, "run.workflow.migrate", details);
			printJson(migrateRunWorkflowOperation(root, { ...details, expectedRevision: options.expectedRevision, actor, proof }));
		});

	command.command("reclaim-expired-claims")
		.option("--item <item-id>", "Recover only this explicitly selected item")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Audited recovery reason")
		.option("--actor <actor>", "System recovery actor", "system:cli-recovery")
		.option("--idempotency-key <key>", "Idempotency key")
		.action(async (options: { item?: string; expectedRevision: string; reason: string; actor: string; idempotencyKey?: string }) => {
			const { reclaimExpiredClaimsOperation } = await import("../domain-operations/service.js");
			printJson(await reclaimExpiredClaimsOperation(resolve(process.cwd()), {
				itemId: options.item,
				expectedRevision: options.expectedRevision,
				reason: options.reason,
				actor: options.actor,
				idempotencyKey: options.idempotencyKey,
			}));
		});

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
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { status: "started" | "heartbeat" | "succeeded" | "failed"; executor: string; expectedRevision: string; reason: string; actor: string; message?: string; recovery?: "retry" | "release" | "handoff" | "human"; errorCode?: string; idempotencyKey?: string }) => {
			const { recordExecutionEvent } = await import("../domain-operations/service.js");
			printJson(await recordExecutionEvent(resolve(process.cwd()), { itemId, status: options.status, executorId: options.executor, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, message: options.message, recovery: options.recovery, errorCode: options.errorCode, idempotencyKey: options.idempotencyKey }));
		});

	command
		.command("claim <item-id>")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--capability <capability>", "Capability usada")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.option("--actor <actor>", "Identidade do actor", "agent:codex")
		.option("--ttl <minutes>", "TTL do claim em minutos", (value) => Number(value), 30)
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { executor: string; capability: string; expectedRevision: string; reason: string; actor: string; ttl: number; idempotencyKey?: string }) => {
			const { claimOperation } = await import("../domain-operations/service.js");
			printJson(await claimOperation(resolve(process.cwd()), { itemId, executorId: options.executor, capability: options.capability, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, ttlMinutes: options.ttl, idempotencyKey: options.idempotencyKey }));
		});
	command
		.command("link-item-spec <item-id>")
		.requiredOption("--spec <spec-id>", "Existing spec ID under workspace data directory")
		.requiredOption("--run <run-id>", "Selected Run ID")
		.requiredOption("--executor <executor-id>", "Executor that owns the selected Run")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for linking the spec")
		.option("--actor <actor>", "Stage actor", "agent:codex")
		.option("--idempotency-key <key>", "Idempotency key")
		.action(async (itemId: string, options: { spec: string; run: string; executor: string; expectedRevision: string; reason: string; actor: string; idempotencyKey?: string }) => {
			const { linkItemSpecOperation } = await import("../domain-operations/service.js");
			printJson(await linkItemSpecOperation(resolve(process.cwd()), {
				itemId,
				specId: options.spec,
				runId: options.run,
				executorId: options.executor,
				expectedRevision: options.expectedRevision,
				reason: options.reason,
				actor: options.actor,
				idempotencyKey: options.idempotencyKey,
			}));
		});

	command
		.command("activate-work <item-id>")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Human prioritization reason")
		.option("--actor <actor>", "Identidade humana", undefined)
		.action(async (itemId: string, options: { expectedRevision: string; reason: string; actor: string }) => {
			const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
			const { activateWorkOperation } = await import("../domain-operations/service.js");
			printJson(await activateWorkOperation(resolve(process.cwd()), { itemId, expectedRevision: options.expectedRevision, reason: options.reason, actor }));
		});

	command
		.command("validate")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for the operation")
		.option("--item <item-id>", "Item alvo quando não há Run selecionada")
		.option("--run <run-id>", "Seleciona o Run cuja direção foi consultada")
		.action(async (options: { expectedRevision: string; reason: string; item?: string; run?: string }) => {
			const { runValidationOperation } = await import("../domain-operations/service.js");
			printJson(await runValidationOperation(resolve(process.cwd()), { ...options, itemId: options.item, runId: options.run }));
		});
	command.command("activity [item-id]").action((itemId?: string) => printJson(activityOperation(resolve(process.cwd()), itemId)));
	command
		.command("gate-decision <item-id>")
		.addOption(new Option("--decision <decision>", "approve, request-changes ou reject").choices(["approve", "request-changes", "reject"]).makeOptionMandatory())
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Audited human decision reason")
		.action(async (itemId: string, options: { decision: "approve" | "request-changes" | "reject"; expectedRevision: string; reason: string }) => {
			const root = resolve(process.cwd());
			const actor = resolveLocalIdentity(root).id;
			const details = { itemId, decision: options.decision, expectedRevision: options.expectedRevision, reason: options.reason };
			const proof = signLocalOperation(root, actor, "gate.decision", details);
			const { decideGateOperation } = await import("../domain-operations/service.js");
			printJson(await decideGateOperation(root, { ...details, actor, proof }));
		});

	command.command("evidence <item-id>")
		.requiredOption("--executor <executor-id>", "Executor externo")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason")
		.requiredOption("--kind <kind>", "diff, file, command, test ou artifact")
		.requiredOption("--value <value>", "Valor/path")
		.requiredOption("--source <source>", "Origem observada")
		.option("--actor <actor>", "Actor", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { executor: string; expectedRevision: string; reason: string; kind: "diff" | "file" | "command" | "test" | "artifact"; value: string; source: string; actor: string; idempotencyKey?: string }) => {
			const { submitEvidenceOperation } = await import("../domain-operations/service.js");
			printJson(await submitEvidenceOperation(resolve(process.cwd()), { itemId, executorId: options.executor, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, evidence: [{ kind: options.kind, value: options.value, source: options.source }], idempotencyKey: options.idempotencyKey }));
		});
	command.command("handoff <item-id>")
		.requiredOption("--to <actor>", "Destino")
		.requiredOption("--executor <executor-id>", "Executor")
		.requiredOption("--summary <summary>", "Resumo")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason")
		.addOption(
			new Option("--evidence <evidence>", "Evidência verificável do handoff")
				.argParser(collectEvidence)
				.default([]),
		)
		.option("--actor <actor>", "Actor", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { to: string; executor: string; summary: string; expectedRevision: string; reason: string; evidence: string[]; actor: string; idempotencyKey?: string }) => {
			const { requestHandoffOperation } = await import("../domain-operations/service.js");
			printJson(await requestHandoffOperation(resolve(process.cwd()), { itemId, to: options.to, executorId: options.executor, summary: options.summary, evidence: options.evidence, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, idempotencyKey: options.idempotencyKey }));
		});

	command
		.command("complete-ac <ac-id>")
		.requiredOption("--item <item-id>", "Explicit target item ID")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for completing the criterion")
		.option("--executor <executor-id>", "Executor que produziu a evidência")
		.option("--run <run-id>", "Run cuja direção foi consultada")
		.option("--actor <actor>", "Identidade do actor", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.addOption(
			new Option("--evidence <evidence>", "Regression evidence")
				.argParser(collectEvidence)
				.default([]),
		)
		.action(
			async (
				acId: string,
				options: {
					item: string;
					expectedRevision: string;
					reason: string;
					evidence: string[];
					executor?: string;
				run?: string;
					actor: string;
					idempotencyKey?: string;
				},
			) => {
				const { completeAcOperation } = await import("../domain-operations/service.js");
				printJson(completeAcOperation(resolve(process.cwd()), { acId, itemId: options.item, executorId: options.executor, runId: options.run, ...options }));
			},
		);

	command
		.command("request-transition <item-id>")
		.requiredOption("--to <stage-id>", "Target stage ID")
		.requiredOption("--expected-revision <revision>", "Direction revision returned by Letra")
		.requiredOption("--reason <reason>", "Reason for requesting the transition")
		.option("--actor <actor>", "Identidade do actor", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(
			async (
				itemId: string,
				options: {
					to: string;
					expectedRevision: string;
					reason: string;
					actor: string;
					idempotencyKey?: string;
				},
			) => {
				const { requestTransitionOperation } = await import("../domain-operations/service.js");
				printJson(
					await requestTransitionOperation(resolve(process.cwd()), {
						itemId,
						targetStageId: options.to,
						expectedRevision: options.expectedRevision,
						reason: options.reason,
						actor: options.actor,
						idempotencyKey: options.idempotencyKey,
					}),
				);
			},
		);

	command.command("passage <item-id>")
		.requiredOption("--stage <stage-id>", "Configured destination stage")
		.requiredOption("--to <actor>", "Configured destination role")
		.requiredOption("--executor <executor-id>", "Source executor")
		.requiredOption("--summary <summary>", "Handoff summary")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason")
		.option("--run <run-id>", "Run cuja direção foi consultada")
		.addOption(new Option("--evidence <evidence>", "Verifiable evidence").argParser(collectEvidence).default([]))
		.option("--actor <actor>", "Source role", "agent:codex")
		.option("--idempotency-key <key>", "Idempotency key")
		.action(async (itemId: string, options: { stage: string; to: string; executor: string; summary: string; expectedRevision: string; reason: string; evidence: string[]; actor: string; run?: string; idempotencyKey?: string }) => {
			const { requestPassageOperation } = await import("../domain-operations/service.js");
			printJson(await requestPassageOperation(resolve(process.cwd()), { itemId, targetStageId: options.stage, to: options.to, executorId: options.executor, runId: options.run, summary: options.summary, evidence: options.evidence, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, idempotencyKey: options.idempotencyKey }));
		});

	command
		.command("release <item-id>")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Reason for releasing the claim")
		.option("--actor <actor>", "Actor", "agent:codex")
		.option("--idempotency-key <key>", "Chave idempotente da operação")
		.action(async (itemId: string, options: { expectedRevision: string; reason: string; actor: string; idempotencyKey?: string }) => {
			const { releaseClaimOperation } = await import("../domain-operations/service.js");
			printJson(await releaseClaimOperation(resolve(process.cwd()), { itemId, expectedRevision: options.expectedRevision, reason: options.reason, actor: options.actor, idempotencyKey: options.idempotencyKey }));
		});

	command
		.command("request-rework <item-id>")
		.requiredOption("--expected-revision <revision>", "Direction revision")
		.requiredOption("--reason <reason>", "Motivo objetivo do retrabalho")
		.addOption(new Option("--ac <description>", "Critério novo a ser implementado").argParser(collectEvidence).default([]).makeOptionMandatory())
		.option("--actor <actor>", "Reviewer que solicita o retrabalho", "reviewer")
		.action(async (itemId: string, options: { expectedRevision: string; reason: string; ac: string[]; actor: string }) => {
			const { requestReworkOperation } = await import("../domain-operations/service.js");
			printJson(await requestReworkOperation(resolve(process.cwd()), {
				itemId,
				expectedRevision: options.expectedRevision,
				reason: options.reason,
				actor: options.actor,
				acceptanceCriteria: options.ac.map((description) => ({ description })),
			}));
		});

	return command;
}
