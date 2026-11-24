import { resolve } from "node:path";
import type { AgentDirectionSnapshot } from "@letra/types";
import { Command } from "commander";

export type DirectionScope = "run" | "item" | "workspace";

/**
 * ITEM-29/39 AC4: which direction this is. Only "run" and "item" revisions
 * are accepted by item operations; a workspace revision is not.
 */
export function directionScope(direction: AgentDirectionSnapshot, itemId?: string): DirectionScope {
	if (direction.assignment?.status === "assigned") return "run";
	if (itemId || direction.item) return "item";
	return "workspace";
}

export const WORKSPACE_SCOPE_WARNING = {
	code: "DIRECTION_SCOPE_WORKSPACE",
	message:
		"Esta é a direção do workspace. Operações de item comparam a direção do item ou da Run: use letra direction --item <ITEM-ID> --json (ou --run <RUN-ID>).",
};

export function withDirectionScope(direction: AgentDirectionSnapshot, itemId?: string) {
	const scope = directionScope(direction, itemId);
	return {
		...direction,
		scope,
		warnings: scope === "workspace" ? [...direction.warnings, WORKSPACE_SCOPE_WARNING] : direction.warnings,
	};
}

export default function directionCommand(): Command {
	return new Command("direction")
		.description("Read the current harness direction through the degraded CLI fallback")
		.option("--json", "Output the complete structured snapshot")
		.option("--run <run-id>", "Select a canonical execution Run")
		.option("--item <item-id>", "Select an explicitly authorized item when no Run is selected")
		.option("--executor <executor-id>", "Bind Run selection to an executor identity")
		.action(async (options: { json?: boolean; run?: string; item?: string; executor?: string }) => {
			const { resolveFallbackDirection } = await import("../agent-direction/fallback.js");
			const direction = withDirectionScope(
				resolveFallbackDirection(resolve(process.cwd()), { runId: options.run, itemId: options.item, executorId: options.executor }),
				options.item,
			);
			if (options.json) {
				process.stdout.write(`${JSON.stringify(direction, null, 2)}\n`);
				return;
			}
			console.log(`Mode: ${direction.mode}`);
			console.log(`Scope: ${direction.scope}`);
			console.log(`Revision: ${direction.revision}`);
			console.log(`Item: ${direction.item?.id ?? "none"}`);
			if (direction.scope === "workspace") console.log(WORKSPACE_SCOPE_WARNING.message);
			console.log("Use --json for the complete direction contract.");
		});
}
