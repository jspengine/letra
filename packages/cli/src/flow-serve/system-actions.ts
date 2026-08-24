import { loadSessionLog, logEntry, type LogEntry } from "../session-log.js";

export type SystemActionStatus = "active" | "idle" | "success" | "error";

export interface RecurringSystemActionDefinition {
	id: string;
	label: string;
	trigger: "watch" | "interval";
	cadence: string;
	cause: string;
	effect: string;
}

export interface SystemActionSnapshot extends RecurringSystemActionDefinition {
	status: SystemActionStatus;
	lastRunAt: string | null;
	lastOutcome: "armed" | "triggered" | "completed" | "failed" | null;
	lastDescription: string | null;
}

export const RECURRING_SYSTEM_ACTIONS: RecurringSystemActionDefinition[] = [
	{
		id: "workflow-watch",
		label: "Workflow watcher",
		trigger: "watch",
		cadence: "sob mudança de arquivo",
		cause: "Mudança em `.letra/workflow.json`",
		effect: "Recarrega estado observável do flow e emite `workflow-updated`",
	},
	{
		id: "specs-watch",
		label: "Specs watcher",
		trigger: "watch",
		cadence: "sob mudança de arquivo",
		cause: "Mudança em `.letra/specs/**`",
		effect: "Atualiza a visão derivada de specs e emite `workflow-updated`",
	},
	{
		id: "diagnostics-scan",
		label: "Diagnostics recurring scan",
		trigger: "interval",
		cadence: "a cada 30 segundos e no boot",
		cause: "Timer do servidor e scan inicial",
		effect: "Sincroniza `health-record` e emite `diagnostics-updated`",
	},
];

interface SystemActionLogOptions {
	outcome: "armed" | "triggered" | "completed" | "failed";
	cause?: string;
	effect?: string;
	error?: string;
	details?: Record<string, unknown>;
}

export function logSystemAction(
	root: string,
	actionId: string,
	options: SystemActionLogOptions,
): LogEntry {
	const definition = RECURRING_SYSTEM_ACTIONS.find((item) => item.id === actionId);
	const cause = options.cause ?? definition?.cause ?? null;
	const effect = options.effect ?? definition?.effect ?? null;
	const descriptionParts = [`automation:${actionId}`, options.outcome];
	if (cause) descriptionParts.push(`cause=${cause}`);
	if (effect) descriptionParts.push(`effect=${effect}`);
	if (options.error) descriptionParts.push(`error=${options.error}`);
	return logEntry(root, "system", descriptionParts.join(" | "), {
		details: {
			systemAction: true,
			actionId,
			outcome: options.outcome,
			trigger: definition?.trigger ?? null,
			cadence: definition?.cadence ?? null,
			cause,
			effect,
			error: options.error ?? null,
			...options.details,
		},
	});
}

export function getRecurringSystemActions(root: string): SystemActionSnapshot[] {
	const entries = loadSessionLog(root).entries;
	return RECURRING_SYSTEM_ACTIONS.map((definition) => {
		const last = [...entries]
			.reverse()
			.find(
				(entry) => entry.action === "system" && entry.details?.actionId === definition.id,
			);
		const lastOutcome =
			typeof last?.details?.outcome === "string" ? last.details.outcome : null;
		const status: SystemActionStatus =
			lastOutcome === "failed"
				? "error"
				: lastOutcome === "completed" || lastOutcome === "triggered"
					? "success"
					: lastOutcome === "armed"
						? "active"
						: "idle";
		return {
			...definition,
			status,
			lastRunAt: last?.timestamp ?? null,
			lastOutcome: (lastOutcome as SystemActionSnapshot["lastOutcome"]) ?? null,
			lastDescription: last?.description ?? null,
		};
	});
}
