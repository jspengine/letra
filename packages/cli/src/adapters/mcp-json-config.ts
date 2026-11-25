/**
 * Projeção do servidor MCP do Letra nos arquivos JSON de configuração de MCP
 * dos editores. Os formatos divergem só na chave raiz e no campo `type`:
 *   - VS Code (`.vscode/mcp.json`):           { "servers":    { letra: { type: "stdio", command, args } } }
 *   - Cursor (`.cursor/mcp.json`) e Kiro
 *     (`.kiro/settings/mcp.json`):            { "mcpServers": { letra: { command, args } } }
 *
 * JSON não tem comentários para delimitar uma seção gerenciada (como o
 * `.codex/config.toml`), então a posse é inferida pela forma da entrada:
 * `letra` só é atualizada quando aponta para `letra mcp serve`. Outros
 * servidores e campos extras do usuário (env, autoApprove, disabled) são
 * preservados.
 */

export type McpJsonDialect = "servers" | "mcpServers";

const LETRA_COMMAND = "letra";
const LETRA_ARGS = ["mcp", "serve", "--stdio"] as const;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function letraMcpEntry(dialect: McpJsonDialect): JsonObject {
	const base = { command: LETRA_COMMAND, args: [...LETRA_ARGS] };
	return dialect === "servers" ? { type: "stdio", ...base } : base;
}

function isLetraManaged(entry: JsonObject): boolean {
	const args = Array.isArray(entry.args) ? entry.args : [];
	return entry.command === LETRA_COMMAND && args[0] === "mcp" && args[1] === "serve";
}

export function mergeMcpJsonConfig(content: string, dialect: McpJsonDialect, path: string): string {
	let doc: unknown = {};
	if (content.trim().length > 0) {
		try {
			doc = JSON.parse(content);
		} catch {
			throw new Error(`"${path}" is not plain JSON (comments are not supported); Letra will not rewrite it.`);
		}
	}
	if (!isObject(doc)) throw new Error(`"${path}" must contain a JSON object.`);

	const servers = doc[dialect] ?? {};
	if (!isObject(servers)) throw new Error(`"${path}" has a "${dialect}" field that is not an object.`);

	const existing = servers.letra;
	if (existing !== undefined && (!isObject(existing) || !isLetraManaged(existing))) {
		throw new Error(`The existing "letra" server in "${path}" is not managed by Letra and will not be overwritten.`);
	}

	const next = { ...doc, [dialect]: { ...servers, letra: { ...(existing ?? {}), ...letraMcpEntry(dialect) } } };
	return `${JSON.stringify(next, null, 2)}\n`;
}
