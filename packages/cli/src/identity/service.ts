import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";

export interface LocalIdentity {
	id: string;
	osUser: string;
	hostname: string;
	createdAt: string;
}

/**
 * Resolve a identidade humana local do workspace.
 * Lê `.letra/identity/local.json` se existir; caso contrário, cria com:
 * - id: human:<uuid>
 * - osUser: userInfo().username
 * - hostname: hash do machineId (não expõe dados sensíveis)
 * - createdAt: ISO timestamp
 *
 * A identidade local é a base de garantia "local" — quem tem acesso ao
 * filesystem do workspace é considerado o humano operando. Não protege
 * contra acesso físico ao filesystem, mas impede que qualquer processo
 * remoto alegue ser human:* sem ter registro local.
 */
export function resolveLocalIdentity(workspaceRoot: string): LocalIdentity {
	const identityDir = join(getLetraDir(workspaceRoot), "identity");
	const identityPath = join(identityDir, "local.json");

	if (existsSync(identityPath)) {
		try {
			return JSON.parse(readFileSync(identityPath, "utf8")) as LocalIdentity;
		} catch {
			// Arquivo corrompido — recria
		}
	}

	const username = userInfo().username.trim();
	const machineId = createHash("sha256")
		.update(`${username}-${process.platform}-${Date.now()}`)
		.digest("hex")
		.slice(0, 16);

	const identity: LocalIdentity = {
		id: `human:local:${randomUUID()}`,
		osUser: username || "unknown",
		hostname: machineId,
		createdAt: new Date().toISOString(),
	};

	mkdirSync(identityDir, { recursive: true });
	writeFileSync(identityPath, JSON.stringify(identity, null, 2), "utf8");

	return identity;
}

/**
 * Verifica se um actor corresponde a uma identidade local registrada.
 * Retorna true se o actor existe no registry local (independente do nome).
 */
export function isKnownLocalActor(workspaceRoot: string, actor: string): boolean {
	if (!actor.startsWith("human:")) return false;
	const identity = resolveLocalIdentity(workspaceRoot);
	return actor === identity.id || actor === `human:${identity.osUser}`;
}
