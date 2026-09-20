import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";
import { resolveLocalIdentity } from "./service.js";

export type OperationLevel = "convention" | "local" | "signed" | "oidc";

function localIdentityPath(root: string): string {
	return join(getLetraDir(root), "identity", "local.json");
}

function hasLocalIdentity(root: string): boolean {
	return existsSync(localIdentityPath(root));
}

/**
 * Valida se o actor atende ao nível de garantia exigido.
 *
 * Backward-compatible: se não há identidade local registrada ainda, não bloqueia
 * (a identidade será criada na primeira operação). Quando a identidade local
 * existe, operações com nível "local" exigem que o actor seja a identidade
 * registrada.
 */
export function assertOperationLevel(
	workspaceRoot: string,
	actor: string,
	requiredLevel: OperationLevel,
): void {
	if (requiredLevel === "convention") return;
	if (requiredLevel === "local") {
		// Backward-compatible: se não há identidade local ainda, não bloqueia
		if (!hasLocalIdentity(workspaceRoot)) return;
		const identity = resolveLocalIdentity(workspaceRoot);
		if (actor !== identity.id && actor !== `human:${identity.osUser}`) {
			throw new Error(
				`OPERATION_LEVEL_REQUIRED: Esta operação exige identidade local verificável. ` +
				`Actor fornecido: "${actor}". Identidade local: "${identity.id}".`,
			);
		}
		return;
	}
	throw new Error(`OPERATION_LEVEL_UNSUPPORTED: Nível '${requiredLevel}' não suportado.`);
}
