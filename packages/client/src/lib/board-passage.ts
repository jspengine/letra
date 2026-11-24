import type { Item, ResolvedFlowRole } from "@letra/types";
import type { ActiveFlowDefinition, ActiveFlowStage } from "./active-flow";

/** Executor recorded when a human operator claims an item through the board. */
export const BOARD_EXECUTOR_ID = "web-ui";

/**
 * Gates protect the exit of the stage that owns them, mirroring the domain
 * passage operation: entering a gated stage is a normal passage, leaving it
 * requires the explicit decision recorded through the gate panel.
 */
export function stageExitRequiresGateDecision(source: ActiveFlowStage | undefined | null): boolean {
	return Boolean(source?.gate?.blocking && source.gate.type === "human");
}

export function gateDecisionRequiredMessage(source: ActiveFlowStage): string {
	return `O estágio ${source.name} exige uma decisão explícita no painel do gate para avançar.`;
}

export type BoardClaimRequest =
	| { role: string; capability: string; executorId: string; error?: undefined }
	| { role?: undefined; capability?: undefined; executorId?: undefined; error: string };

function hasActiveHandoff(item: Item, now: number): boolean {
	if (!item.handoff) return false;
	const expiresAt = Date.parse(item.handoff.expiresAt);
	return Number.isFinite(expiresAt) && expiresAt > now;
}

function stageRoleIds(stage: ActiveFlowStage): string[] {
	return [...new Set([...(stage.agents ?? []), ...(stage.roleIds ?? [])])];
}

/**
 * Resolves the role the board claims for: an active handoff names its
 * recipient role, otherwise the stage must have exactly one role. Claiming as
 * the role (not as the human session) is what lets the domain accept the
 * handoff and later authorize the passage out of the stage.
 */
export function boardClaimRequest(
	item: Item,
	stage: ActiveFlowStage | undefined | null,
	activeFlow: ActiveFlowDefinition | null,
	now = Date.now(),
): BoardClaimRequest {
	if (!stage) return { error: `O estágio ${item.stage} não existe no workflow ativo.` };
	const stageRoles = stageRoleIds(stage);
	let role: string | undefined;
	if (hasActiveHandoff(item, now) && item.handoff && !item.handoff.to.startsWith("human")) {
		role = item.handoff.to;
	} else if (stageRoles.length === 1) {
		role = stageRoles[0];
	}
	if (!role) {
		return {
			error: stageRoles.length === 0
				? `O estágio ${stage.name} não tem papel configurado para o claim.`
				: `O estágio ${stage.name} tem mais de um papel (${stageRoles.join(", ")}); faça o claim pelo executor do papel.`,
		};
	}
	const definition: ResolvedFlowRole | undefined =
		stage.roles.find((candidate) => candidate.id === role) ??
		activeFlow?.roles.find((candidate) => candidate.id === role);
	// Automatic on_enter hooks that run under the claim pin the capability the
	// domain accepts (for example security_review -> security_scan).
	const hookCapability = (stage.hooks?.on_enter ?? [])
		.filter((hook) => hook.auto && hook.requiresClaim && hook.action !== "capture_baseline")
		.map((hook) => activeFlow?.operations[hook.action]?.requiredCapability)
		.find((value): value is string => Boolean(value));
	const capability = hookCapability ?? definition?.capabilities[0];
	if (!capability) {
		return { error: `O papel ${role} não declara capability para o claim.` };
	}
	return { role, capability, executorId: BOARD_EXECUTOR_ID };
}
