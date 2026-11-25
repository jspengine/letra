/**
 * ITEM-58 AC3: a busy workspace lock that escapes as an exception must still
 * reach the caller as a refusal (JSON, exit 1) with the command to repeat,
 * instead of killing the process with a stack trace and no answer.
 */
export const WORKSPACE_BUSY_ERROR = "WORKSPACE_TRANSACTION_BUSY";

/** Quotes an argument so the repeated command survives bash and PowerShell. */
function quoteArg(arg: string): string {
	return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replace(/["`$\\]/g, "")}"`;
}

/** The refusal printed for a busy workspace, repeating the same command. */
export function workspaceBusyRefusal(argv: readonly string[]): Record<string, unknown> {
	return {
		outcome: "rejected",
		reasonCode: "WORKSPACE_BUSY",
		reason: "O workspace está ocupado por outra operação (por exemplo o board gravando); nada foi alterado. Repita o comando.",
		nextCommand: ["letra", ...argv.map(quoteArg)].join(" "),
		humanRequired: false,
	};
}

export function isWorkspaceBusyError(error: unknown): boolean {
	return error instanceof Error && error.message === WORKSPACE_BUSY_ERROR;
}

/** Installs the process-level handler; other errors keep their default behaviour. */
export function installWorkspaceBusyHandler(argv: readonly string[] = process.argv.slice(2)): void {
	const handle = (error: unknown) => {
		if (!isWorkspaceBusyError(error)) throw error;
		process.stdout.write(`${JSON.stringify(workspaceBusyRefusal(argv), null, 2)}\n`);
		process.exit(1);
	};
	process.on("uncaughtException", handle);
	process.on("unhandledRejection", handle);
}
