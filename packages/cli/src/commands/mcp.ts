import { resolve } from "node:path";
import { Command } from "commander";

export default function mcpCommand(): Command {
	const command = new Command("mcp").description("Expose Letra harness capabilities through MCP");

	command
		.command("serve")
		.option("--stdio", "Use the local stdio transport")
		.description("Start the local read-only Letra MCP server")
		.action(async () => {
			const { startLetraMcpServer } = await import("../mcp/server.js");
			await startLetraMcpServer(resolve(process.cwd()));
		});

	return command;
}
