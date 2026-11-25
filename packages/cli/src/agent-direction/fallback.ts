import type { AgentDirectionSnapshot } from "@letra/types";
import { resolveDirection, type ResolveDirectionOptions } from "./service.js";
import { loadWorkflow } from "../commands/flow-init.js";
import { logEntry } from "../session-log.js";

const FALLBACK_WARNING = {
	code: "LIVE_CONTEXT_UNAVAILABLE",
	message:
		"O contexto vivo por MCP não está sendo usado. Execute letra direction --json antes de agir e novamente antes de concluir.",
};

export function resolveFallbackDirection(root: string, options: ResolveDirectionOptions = {}): AgentDirectionSnapshot {
	const canonical = resolveDirection(root, options);
	const mode = !loadWorkflow(root) ? "unconfigured" : "degraded";
	if (mode === "degraded") {
		try {
			logEntry(root, "adapter_degraded", "MCP não está disponível; modo degradado ativado.", {
				itemId: canonical.item?.id,
				details: {
					adapter: "cli",
					mode: "degraded",
					revision: canonical.revision,
					outcome: "accepted",
				},
			});
		} catch {
			return {
				...canonical,
				mode,
				warnings: [
					...canonical.warnings.filter((warning) => warning.code !== FALLBACK_WARNING.code),
					FALLBACK_WARNING,
					{ code: "AUDIT_DEGRADED", message: "Auditoria indisponível; direção retornada sem registro." },
				],
			};
		}
	}
	return {
		...canonical,
		mode,
		warnings: [
			...canonical.warnings.filter((warning) => warning.code !== FALLBACK_WARNING.code),
			FALLBACK_WARNING,
		],
	};
}
