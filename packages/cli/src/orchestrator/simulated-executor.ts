import type { RichAgenticExecutor } from "../executor/executor.js";
import type { ExecutionContext, ExecutionResult } from "../harness/types.js";

/**
 * Deterministic executor used by the local semiautonomous flow preview.
 * It produces auditable evidence and hands off to the next configured role;
 * it never edits the project or approves a human gate.
 */
export function createSimulatedExecutor(
	id: string,
	capabilities: string[] = ["design", "code", "review", "security"],
): RichAgenticExecutor {
	return {
		id,
		label: `Simulated ${id}`,
		capabilities,
		status: "online",
		heartbeat: async () => undefined,
		async execute(context: ExecutionContext): Promise<ExecutionResult> {
			const stages = Array.isArray((context.snapshot as { stages?: unknown[] })?.stages)
				? ((context.snapshot as { stages: Array<{ id: string; order: number; agents?: string[] }> }).stages)
				: [];
			const current = stages.find((stage) => stage.id === context.stage);
			const next = current
				? stages
						.filter((stage) => stage.order > current.order)
						.sort((a, b) => a.order - b.order)[0]
				: undefined;
			const target = next?.agents?.[0] ?? "human";
			const timestamp = new Date().toISOString();
			return {
				success: true,
				output: `Simulated execution completed for ${context.itemId} at ${context.stage}`,
				artifacts: [],
				evidences: [`simulated:${context.stage}:${context.itemId}`],
				handoff: {
					type: "handoff",
					itemId: context.itemId,
					from: id,
					to: target,
					summary: `Simulated ${context.stage} completed; awaiting ${target}.`,
					evidence: [`simulated:${context.stage}:${context.itemId}`],
					timestamp,
				},
			};
		},
	};
}
