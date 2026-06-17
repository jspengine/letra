import type { AdapterFormat, HarnessSnapshot } from "./types.js";

const L1_FILES = [".letra/context.md", ".letra/constitution.md", ".letra/glossary.md", ".letra/constraints.md"] as const;

function formatL1(snapshot: HarnessSnapshot, format: AdapterFormat): string {
	if (format === "at") {
		const lines = L1_FILES.map((path) => `@${path}`);
		if (snapshot.hasFocus) lines.push("@.letra/focus.md");
		return lines.join("\n");
	}

	const lines = [...L1_FILES.map((path) => `- ${path}`)];
	if (snapshot.hasFocus) {
		lines.push("- .letra/focus.md");
	} else {
		lines.push("- .letra/focus.md");
	}
	return lines.join("\n");
}

function formatDate(iso: string): string {
	if (!iso) return "";
	try {
		return new Date(iso).toLocaleString("pt-BR");
	} catch {
		return "";
	}
}

// P1 — Protocolo Obrigatório de Início
function formatProtocol(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.hasWorkflow) return null;

	const primaryItem = snapshot.primaryItemId
		? snapshot.items.find((i) => i.id === snapshot.primaryItemId)
		: snapshot.items[0];

	const acLine = snapshot.totalACs > 0
		? `ACs: ${snapshot.pendingACs}/${snapshot.totalACs} pendentes`
		: "";

	const lines: string[] = [
		"PASSO OBRIGATÓRIO #1: letra pulse — verificar estado do workspace",
		"PASSO OBRIGATÓRIO #2: Leia .letra/context.md — contexto completo do projeto",
		"PASSO OBRIGATÓRIO #3: Leia .letra/focus.md — foco e outcome da sessão",
	];

	if (snapshot.focusSpec) {
		lines.push(`PASSO OBRIGATÓRIO #4: Leia .letra/specs/${snapshot.focusSpec}/spec.md — ACs do item`);
	} else if (primaryItem?.spec) {
		lines.push(`PASSO OBRIGATÓRIO #4: Leia .letra/specs/${primaryItem.spec}/spec.md — ACs do item`);
	} else {
		lines.push("PASSO OBRIGATÓRIO #4: Identifique o item ativo via `letra pulse` e leia sua spec");
	}

	return lines.join("\n");
}

// P2 — Foco Atual
function formatFocus(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.hasWorkflow) return null;

	const primaryItem = snapshot.primaryItemId
		? snapshot.items.find((i) => i.id === snapshot.primaryItemId)
		: snapshot.items[0];

	if (!primaryItem) return null;

	const lines: string[] = [
		`Item: ${primaryItem.id} · ${primaryItem.description}`,
	];

	if (snapshot.focusSpec) lines.push(`Spec: ${snapshot.focusSpec}`);

	if (snapshot.activeStage) {
		const stageLine = `Estágio: ${snapshot.activeStage.name}`;
		if (snapshot.nextStage) {
			lines.push(`${stageLine} → ${snapshot.nextStage.name}`);
		} else {
			lines.push(stageLine);
		}
	}

	if (snapshot.totalACs > 0) {
		lines.push(`ACs: ${snapshot.pendingACs}/${snapshot.totalACs} pendentes`);
	}

	return lines.join("\n");
}

// P3 — Alertas Ativos
function formatAlerts(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.alerts || snapshot.alerts.length === 0) return null;

	const lines: string[] = [];
	for (const alert of snapshot.alerts) {
		if (alert.id === "...") {
			lines.push(`  ${alert.title}`);
			continue;
		}
		const severityLabel = alert.severity === "alta" ? "alta" : alert.severity === "media" ? "média" : "baixa";
		lines.push(`Alerta · severidade ${severityLabel}`);
		lines.push(`  ID: ${alert.id}`);
		lines.push(`  O que: ${alert.title}`);
		lines.push(`  Onde: ${alert.source}`);
		lines.push(`  Desde: ${formatDate(alert.detectedAt)}`);
		lines.push(`  Ação: \`letra health ack ${alert.id}\``);
		lines.push("");
	}
	return lines.join("\n");
}

// P4 — Regras (Violação = Erro Grave)
function formatProhibitionRules(): string {
	return [
		"**Violação = Erro Grave**",
		"",
		"- Não edite workflow.json manualmente — use `letra flow` e `letra focus`",
		"- Não crie specs fora de .letra/specs/ — use `letra spec new`",
		"- Não pule os passos obrigatórios de início acima",
		"- Execute `letra validate` antes de mover item entre estágios",
		"- Siga a constitution.md rigorosamente",
	].join("\n");
}

// Fluxo de Execução
function formatExecutionFlow(): string {
	return [
		"**Loop por AC**:",
		"  1. Implemente o AC no código",
		`  2. \`letra ac done <AC-ID>\` — marca como concluído no spec.md`,
		"  3. \`letra validate\` — verifica se ACs estão consistentes",
		"  4. Repita até todos os ACs do item estarem concluídos",
		"",
		"**Ao concluir todos ACs**:",
		`  → \`letra pulse\` — confirma estado`,
		`  → \`letra sitrep\` — atualiza context.md`,
		`  → \`letra flow move <ITEM-ID> --auto\` — avança para próximo estágio`,
	].join("\n");
}

// P5 — Comandos
function formatCommands(): string {
	return [
		"**Leitura (seguro — não muda nada):**",
		"  `letra pulse`                    — Overview do workspace",
		"  `letra health`                   — Alertas ativos",
		"  `letra flow board`               — Todas as colunas do fluxo",
		"  `letra flow backlog`             — Itens no backlog",
		"  `letra validate`                 — Validar specs e ACs",
		"",
		"**Escrita (muda estado):**",
		"  `letra health ack <id>`          — Reconhecer alerta",
		"  `letra health dismiss <id>`      — Descartar alerta",
		"  `letra health scan`              — Re-executar verificações",
		"  `letra sitrep`                   — Atualizar context.md",
		"  `letra flow move <id> --to <s>`  — Mover item entre estágios",
		"  `letra focus <spec>`             — Definir foco",
		"  `letra focus --clear`            — Limpar foco",
	].join("\n");
}

// P6 — Encerramento
function formatCompletionChecklist(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.hasWorkflow) return null;
	return [
		"1. `letra pulse --json` — veja itens, ACs, alertas, backlog",
		"",
		"2. Decida o estado:",
		"",
		"   **CONTINUE** (backlog tem itens OU item atual tem ACs pendentes):",
		"     → Relate o progresso: quais ACs fez, o que falta, onde parou",
		"     → Se sessão >30 min, pare e relate. Caso contrário, continue.",
		"",
		"   **BLOCKED** (backlog vazio, item sem ACs pendentes, aguardando humano):",
		'     → Relate "Trabalho concluído, aguardando revisão"',
		"     → Liste o que foi feito e decisões necessárias",
		"",
		"   **ALL_DONE** (todos os itens em Done, backlog vazio):",
		"     → Relate missão completa: itens concluídos, o que foi construído, próximos passos",
	].join("\n");
}

// P7 — Continuidade (opcional)
function formatContinuity(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.lastSession) return null;
	return [
		`Última atividade: ${snapshot.lastSession.lastDate}`,
		`Ações:\n  • ${snapshot.lastSession.actionsSummary}`,
	].join("\n");
}

export function formatAdapterContent(
	snapshot: HarnessSnapshot,
	format: AdapterFormat,
	options: { source: "init" | "flow-move" | "focus"; displayName: string },
): string {
	const title = snapshot.hasWorkflow
		? `# Letra Session — ${snapshot.workflowName}`
		: `# Letra Context — ${options.displayName} Adapter`;

	// P1: Protocolo (sempre, sem workflow vira L1)
	const sections: string[] = [];
	if (!snapshot.hasWorkflow) {
		// Sem workflow: formato simplificado
		sections.push(title);
		if (format === "at") {
			sections.push(L1_FILES.map((p) => `@${p}`).join("\n"));
		} else {
			sections.push("Read the following files before starting any task:\n" +
				L1_FILES.map((p) => `- ${p}`).join("\n"));
		}
		if (snapshot.hasFocus) sections[1] += format === "at" ? "\n@.letra/focus.md" : "\n- .letra/focus.md";
		sections.push(...["", formatRulesText()]);
		return sections.join("\n");
	}

	sections.push(title);

	const protocol = formatProtocol(snapshot);
	if (protocol) sections.push(protocol);

	const focus = formatFocus(snapshot);
	if (focus) {
		sections.push(`## Foco Atual\n\n${focus}`);
	}

	// Grave alerts go right after protocol
	const hasGrave = snapshot.alerts?.some((a) => a.severity === "alta");
	if (hasGrave) {
		const graveAlerts = snapshot.alerts?.filter((a) => a.severity === "alta") || [];
		sections.push(`## ⚠ ATENÇÃO — Problema Grave\n\n${formatAlerts({ ...snapshot, alerts: graveAlerts })}`);
	}

	const alerts = formatAlerts(snapshot);
	if (alerts && !hasGrave) {
		sections.push(`## Alertas\n\n${alerts}`);
	} else if (alerts && hasGrave) {
		const nonGrave = snapshot.alerts?.filter((a) => a.severity !== "alta");
		if (nonGrave && nonGrave.length > 0) {
			sections.push(`## Alertas\n\n${formatAlerts({ ...snapshot, alerts: nonGrave })}`);
		}
	}

	sections.push(`## Regras (Violação = Erro Grave)\n\n${formatProhibitionRules()}`);

	if (snapshot.hasWorkflow) {
		sections.push(`## Fluxo de Execução\n\n${formatExecutionFlow()}`);
	}

	sections.push(`## Comandos\n\n${formatCommands()}`);

	const continuity = formatContinuity(snapshot);
	if (continuity) {
		sections.push(`## Continuidade\n\n${continuity}`);
	}

	sections.push(`## Checklist de Encerramento\n\n${formatCompletionChecklist(snapshot)}`);

	// L1 references at the end
	const refs = formatL1(snapshot, format);
	sections.push(`## Arquivos de Contexto\n\n${refs}`);

	return `${sections.join("\n\n")}\n`;
}

function formatRulesText(): string {
	return [
		"# Rules",
		"- Always read specs in .letra/specs/ before writing code",
		"- Run `letra validate` to check acceptance criteria",
		"- Execute `letra ac done <ID>` after implementing each AC",
		"- Follow the constitution.md rules strictly",
		"- Use formal tone in all generated content",
	].join("\n");
}
