import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";
import { resolveLocalIdentity } from "./service.js";
import { assertSignedOperation, type SignedOperationProof } from "./signing.js";

export type OperationLevel = "convention" | "local" | "signed" | "oidc";

export const OPERATION_REQUIRED_LEVELS = {
	"item.create": "local",
	"item.update": "local",
	"item.delete": "local",
	"workflow.transition.force": "local",
	"workflow.activate": "local",
	"gate.decision": "signed",
	"workflow.publish": "local",
	"workflow.rollback": "signed",
	"run.workflow.migrate": "signed",
} as const satisfies Record<string, OperationLevel>;

function localIdentityPath(root: string): string {
	return join(getLetraDir(root), "identity", "local.json");
}

function hasLocalIdentity(root: string): boolean {
	return existsSync(localIdentityPath(root));
}

/**
 * Valida se o actor atende ao nível de garantia exigido.
 *
 * Operações locais exigem identidade já registrada por uma superfície humana
 * confiável (CLI ou sessão HTTP). O domínio nunca faz bootstrap por um actor
 * fornecido no payload.
 */
export function assertOperationLevel(
	workspaceRoot: string,
	actor: string,
	requiredLevel: OperationLevel,
	signed?: { operation: string; details: unknown; proof?: SignedOperationProof },
): void {
	if (requiredLevel === "convention") return;
	if (requiredLevel === "signed") {
		if (!signed) throw new Error("SIGNED_OPERATION_REQUIRED");
		assertSignedOperation(workspaceRoot, actor, signed.operation, signed.details, signed.proof);
		return;
	}
	if (requiredLevel === "local") {
		if (!hasLocalIdentity(workspaceRoot)) throw new Error("LOCAL_IDENTITY_REQUIRED");
		const identity = resolveLocalIdentity(workspaceRoot);
		if (actor !== identity.id) {
			throw new Error(
				`OPERATION_LEVEL_REQUIRED: Esta operação exige identidade local verificável. ` +
					`Actor fornecido: "${actor}". Identidade local: "${identity.id}".`,
			);
		}
		return;
	}
	throw new Error(`OPERATION_LEVEL_UNSUPPORTED: Nível '${requiredLevel}' não suportado.`);
}

/**
 * Versão safe de requireLocalHuman para funções async que retornam OperationResult.
 * Captura o throw de assertOperationLevel e retorna uma mensagem de rejeição uniforme.
 *
 * Ausência do registry falha fechada; cabe à superfície humana criar a
 * identidade antes de invocar uma operação de nível local.
 */
export function requireLocalHumanSafe(
	workspaceRoot: string,
	actor: string | undefined,
	operation: string,
): string | null {
	try {
		assertOperationLevel(workspaceRoot, actor ?? "", "local");
		return null;
	} catch {
		return `HUMAN_ACTOR_REQUIRED: Esta operação (${operation}) exige identidade humana verificável. Actor fornecido: "${actor ?? "(none)"}".`;
	}
}

/**
 * Versão STRICT para operações de segurança crítica (decideGate, activateWork, force).
 *
 * SEMPRE exige que o actor tenha prefixo "human:" — não há backward-compat
 * passivo. Além disso, exige a identidade local registrada e valida que o actor
 * corresponde à identidade registrada (defesa contra spoof do prefixo).
 *
 * Rationale: operações que bypass gates ou decidem gates não podem ser feitas
 * por agentes (mcp:*) mesmo antes da identity existir — isso seria um bypass
 * de segurança na fresh workspace. O humano precisa operar via CLI/UI para
 * bootstrap da identity; agentes são rejeitados por não corresponder.
 */
export function requireLocalHumanStrict(
	workspaceRoot: string,
	actor: string | undefined,
	operation: string,
): string | null {
	// 1. Sempre exigir prefixo "human:" — sem isto, é agente
	if (!actor?.trim() || !actor.startsWith("human:")) {
		return `HUMAN_ACTOR_REQUIRED: Esta operação (${operation}) exige identidade humana verificável. Actor fornecido: "${actor ?? "(none)"}".`;
	}
	// 2. Se identity local existe, validar correspondência (defesa contra spoof)
	try {
		const level = OPERATION_REQUIRED_LEVELS[operation as keyof typeof OPERATION_REQUIRED_LEVELS] ?? "local";
		if (level === "signed") throw new Error("SIGNED_OPERATION_REQUIRED");
		assertOperationLevel(workspaceRoot, actor, level);
		return null;
	} catch {
		return `HUMAN_ACTOR_REQUIRED: Esta operação (${operation}) exige identidade humana verificável. Actor fornecido: "${actor}". A identidade local registrada não corresponde.`;
	}
}
