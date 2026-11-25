import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { Command } from "commander";

export default function mcpCommand(): Command {
	const command = new Command("mcp").description("Expose Letra harness capabilities through MCP");

	command
		.command("serve")
		.option("--stdio", "Use the local stdio transport")
		.option("--profile <profile>", "Tool surface: agent (executor tools only) or full", "agent")
		.description("Start the local Letra MCP server")
		.action(async (opts: { profile: string }) => {
			if (opts.profile !== "agent" && opts.profile !== "full") {
				console.error(`Invalid --profile "${opts.profile}". Use "agent" or "full".`);
				process.exitCode = 1;
				return;
			}
			const { startLetraMcpServer } = await import("../mcp/server.js");
			await startLetraMcpServer(resolve(process.cwd()), { profile: opts.profile, version: command.parent?.version() });
		});

	command
		.command("restart")
		.description("Restart the local MCP server (kills running process, opencode will restart it)")
		.action(() => {
			try {
				// Find all MCP server processes (both local and global)
				const cmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -like '*mcp*serve*' } | Select-Object -ExpandProperty ProcessId"`;
				const output = execSync(cmd, { encoding: "utf-8" }).trim();
				const pids = output.split("\n").filter((p) => p.trim());

				if (pids.length === 0) {
					console.log("No MCP server processes found.");
					return;
				}

				console.log(`Found ${pids.length} MCP server process(es): ${pids.join(", ")}`);
				for (const pid of pids) {
					try {
						execSync(`taskkill /PID ${pid.trim()} /F`, { encoding: "utf-8" });
						console.log(`Killed process ${pid.trim()}`);
					} catch {
						console.log(`Process ${pid.trim()} already terminated`);
					}
				}
				console.log("MCP server killed. Opencode will restart it automatically.");
			} catch (error) {
				console.log("No MCP server processes found or error occurred.");
			}
		});

	return command;
}
