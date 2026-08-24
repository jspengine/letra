const MANAGED_START = "# letra:codex-mcp:start";
const MANAGED_END = "# letra:codex-mcp:end";

const MCP_BLOCK = [
	MANAGED_START,
	"[mcp_servers.letra]",
	'command = "letra"',
	'args = ["mcp", "serve", "--stdio"]',
	"enabled = true",
	"required = false",
	MANAGED_END,
].join("\n");

export function mergeCodexProjectConfig(content: string): string {
	const start = content.indexOf(MANAGED_START);
	const end = content.indexOf(MANAGED_END);
	if (start >= 0 !== end >= 0 || (start >= 0 && end < start)) {
		throw new Error("The Letra-managed Codex MCP section is malformed.");
	}
	if (start >= 0 && end >= 0) {
		const blockEnd = end + MANAGED_END.length;
		return `${content.slice(0, start)}${MCP_BLOCK}${content.slice(blockEnd)}`;
	}
	if (/^\s*\[mcp_servers\.letra\]\s*$/m.test(content)) {
		throw new Error(
			'The existing "mcp_servers.letra" table is not managed by Letra and will not be overwritten.',
		);
	}
	if (content.length === 0) return `${MCP_BLOCK}\n`;
	const separator = content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
	return `${content}${separator}${MCP_BLOCK}\n`;
}

export function renderLetraHarnessSkill(): string {
	return [
		"---",
		"name: letra-harness",
		"description: Consulte e siga a direção vigente do harness Letra ao implementar, revisar, validar ou avançar trabalho no workspace.",
		"---",
		"",
		"# Letra Harness",
		"",
		"1. Consulte `get_direction` antes de planejar a atividade.",
		"2. Confirme a spec e o AC vigente antes da primeira escrita.",
		"3. Proteja o comportamento existente com teste de regressão.",
		"4. Trabalhe somente dentro das permissões e proibições retornadas.",
		"5. Consulte novamente `get_direction` antes de concluir ou solicitar transição.",
		"6. Use apenas ferramentas de mutação fornecidas pelo Letra para alterar o estado canônico.",
		"",
		"## Fallback quando o MCP estiver indisponível",
		"",
		"1. Execute `letra direction --json` e trate a resposta como modo degradado.",
		'2. Use a revisão retornada ao executar `letra operation validate --expected-revision <REVISION> --reason "<MOTIVO>"`.',
		"3. Para concluir ou avançar, use os subcomandos controlados de `letra operation`; nunca contorne o harness.",
		"4. Execute novamente `letra direction --json` antes de cada mutação.",
		"",
		"Esta skill define procedimento. Item, stage, AC e próxima ação sempre vêm do contexto vivo.",
		"",
	].join("\n");
}

export function appendCodexLiveContextInstructions(content: string): string {
	return [
		content.trimEnd(),
		"",
		"## Contexto vivo do Letra para Codex",
		"",
		"- Consulte `get_direction` antes de planejar, antes da primeira escrita e antes de concluir.",
		"- A resposta com revisão mais recente prevalece sobre snapshots textuais deste arquivo.",
		"- Se `get_direction` estiver indisponível, execute `letra direction --json`; a resposta declara modo degradado e mantém a autoridade do harness.",
		"- No fallback, valide e altere estado somente por `letra operation`, sempre com a revisão retornada.",
		"- Não conclua AC nem solicite transição por caminhos que contornem o harness.",
		"",
	].join("\n");
}
