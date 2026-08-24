import { resolve } from "node:path";
import { Command } from "commander";

export default function directionCommand(): Command {
	return new Command("direction")
		.description("Read the current harness direction through the degraded CLI fallback")
		.option("--json", "Output the complete structured snapshot")
		.action(async (options: { json?: boolean }) => {
			const { resolveFallbackDirection } = await import("../agent-direction/fallback.js");
			const direction = resolveFallbackDirection(resolve(process.cwd()));
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
