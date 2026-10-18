import { resolve } from "node:path";
import { Command } from "commander";

export default function directionCommand(): Command {
	return new Command("direction")
		.description("Read the current harness direction through the degraded CLI fallback")
		.option("--json", "Output the complete structured snapshot")
		.option("--run <run-id>", "Select a canonical execution Run")
		.option("--item <item-id>", "Select an explicitly authorized item when no Run is selected")
		.option("--executor <executor-id>", "Bind Run selection to an executor identity")
		.action(async (options: { json?: boolean; run?: string; item?: string; executor?: string }) => {
			const { resolveFallbackDirection } = await import("../agent-direction/fallback.js");
			const direction = resolveFallbackDirection(resolve(process.cwd()), { runId: options.run, itemId: options.item, executorId: options.executor });
			if (options.json) {
				process.stdout.write(`${JSON.stringify(direction, null, 2)}\n`);
				return;
			}
			console.log(`Mode: ${direction.mode}`);
			console.log(`Revision: ${direction.revision}`);
			console.log(`Item: ${direction.item?.id ?? "none"}`);
			console.log("Use --json for the complete direction contract.");
		});
}
