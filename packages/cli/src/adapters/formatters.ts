import type {
	AdapterFormat,
	AdapterSource,
	HarnessSnapshot,
	HarnessDirectionActivity,
} from "./types.js";

const L1_FILES = [
	".letra/context.md",
	".letra/constitution.md",
	".letra/glossary.md",
	".letra/constraints.md",
] as const;

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

function formatMarkdownReferences(snapshot: HarnessSnapshot): string {
	const links = snapshot.referenceLinks;
	const lines = [
		`- [Context](${links.context})`,
		`- [Constitution](${links.constitution})`,
		`- [Glossary](${links.glossary})`,
		`- [Constraints](${links.constraints})`,
	];
	if (links.focus) lines.push(`- [Focus](${links.focus})`);
	if (links.spec && snapshot.focusSpec) {
		lines.push(`- [Spec: ${snapshot.focusSpec}](${links.spec})`);
	}
	if (snapshot.primaryItemId) {
		lines.push(`- [${snapshot.primaryItemId}](${links.workflow})`);
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

	const acLine =
		snapshot.totalACs > 0 ? `ACs: ${snapshot.pendingACs}/${snapshot.totalACs} pendentes` : "";

	const lines: string[] = [
		"PASSO OBRIGATÓRIO #1: letra pulse — verificar estado do workspace",
		"PASSO OBRIGATÓRIO #2: Leia .letra/context.md — contexto completo do projeto",
		"PASSO OBRIGATÓRIO #3: Leia .letra/focus.md — foco e outcome da sessão",
	];

	if (snapshot.focusSpec) {
		lines.push(
			`PASSO OBRIGATÓRIO #4: Leia .letra/specs/${snapshot.focusSpec}/spec.md — ACs do item`,
		);
	} else if (primaryItem?.spec) {
		lines.push(
			`PASSO OBRIGATÓRIO #4: Leia .letra/specs/${primaryItem.spec}/spec.md — ACs do item`,
		);
	} else {
		lines.push(
			"PASSO OBRIGATÓRIO #4: Identifique o item ativo via `letra pulse` e leia sua spec",
		);
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

	const lines: string[] = [`Item: ${primaryItem.id} · ${primaryItem.description}`];

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
		const severityLabel =
			alert.severity === "alta" ? "alta" : alert.severity === "media" ? "média" : "baixa";
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
		"  2. `letra ac done <AC-ID>` — marca como concluído no spec.md",
		"  3. `letra validate` — verifica se ACs estão consistentes",
		"  4. Repita até todos os ACs do item estarem concluídos",
		"",
		"**Ao concluir todos ACs**:",
		"  → `letra pulse` — confirma estado",
		"  → `letra sitrep` — atualiza context.md",
		"  → `letra flow move <ITEM-ID> --auto` — avança para próximo estágio",
	].join("\n");
}

// P5 — Direção do Harness
function formatHarnessDirection(snapshot: HarnessSnapshot, format: AdapterFormat): string | null {
	const dir = snapshot.harnessDirection;
	if (!dir) return null;

	const itemId = snapshot.primaryItemId;
	const item = itemId ? snapshot.items.find((i) => i.id === itemId) : null;
	const stageId = snapshot.activeStage?.id;
	const stageName = snapshot.activeStage?.name;
	const version = dir.harnessVersion;

	// AC4: Sem item ativo → fallback message
	if (!itemId && snapshot.hasWorkflow) {
		if (format === "at") {
			return [
				"# harness-direction:start",
				"## Direção do Harness",
				"",
				"@aviso: Nenhum item em andamento. Consulte o backlog para priorizar.",
				"# harness-direction:end",
			].join("\n");
		}
		return [
			"<!-- harness-direction:start -->",
			"**Aviso**: Nenhum item em andamento. Consulte o backlog para priorizar.",
			"<!-- harness-direction:end -->",
		].join("\n");
	}

	// AC4: Estágio sem activity → papel + item + estágio apenas
	const hasActivity =
		dir.activities.length > 0 &&
		dir.activities.some(
			(a) =>
				a.objective ||
				(a.commands && a.commands.length > 0) ||
				(a.mustNotDo && a.mustNotDo.length > 0) ||
				(a.nextActions && a.nextActions.length > 0),
		);

	if (!hasActivity) {
		const roleLabel = dir.roleIds.length > 0 ? dir.roleIds.join(", ") : null;
		const itemLabel = item
			? `${item.id} — ${item.description} (${stageName ?? stageId})`
			: null;

		if (format === "at") {
			const lines = ["# harness-direction:start", "## Direção do Harness", ""];
			const metaParts = [
				version ? `@harness: ${version}` : "",
				roleLabel ? `papel: ${roleLabel}` : "",
				stageId ? `estágios: ${stageId}` : "",
			].filter(Boolean);
			if (metaParts.length > 0) lines.push(metaParts.join(" | "));
			if (itemLabel) lines.push(`@item: ${itemLabel}`);
			lines.push("@aviso: Estágio sem activity configurada no harness.");
			lines.push("# harness-direction:end");
			return lines.join("\n");
		}

		const body: string[] = [];
		const meta = [
			version ? `**Versão**: ${version}` : "",
			roleLabel ? `**Papel**: ${roleLabel}` : "",
			stageId ? `**Estágios**: ${stageId}` : "",
		]
			.filter(Boolean)
			.join(" | ");
		if (meta) body.push(meta);
		if (itemLabel) body.push(`**Item**: ${itemLabel}`);
		body.push("_Estágio sem activity configurada no harness._");
		return `<!-- harness-direction:start -->\n${body.join("\n")}\n<!-- harness-direction:end -->`;
	}

	// Separate gate activities from work activities; prefer work data
	const gateActivities = dir.activities.filter((a) => a.kind === "gate");
	const workActivities = dir.activities.filter((a) => a.kind !== "gate");
	const aggObjective =
		workActivities.find((a) => a.objective)?.objective ??
		gateActivities.find((a) => a.objective)?.objective;
	const aggCommands =
		workActivities.length > 0
			? workActivities.flatMap((a) => a.commands ?? [])
			: gateActivities.flatMap((a) => a.commands ?? []);
	const aggMustNotDo =
		workActivities.length > 0
			? workActivities.flatMap((a) => a.mustNotDo ?? [])
			: gateActivities.flatMap((a) => a.mustNotDo ?? []);
	const aggNextActions =
		workActivities.length > 0
			? workActivities.flatMap((a) => a.nextActions ?? [])
			: gateActivities.flatMap((a) => a.nextActions ?? []);
	// Gate sub-section (only if gate has unique data beyond work activities)
	const gateSub =
		gateActivities.length > 0 &&
		(gateActivities.some(
			(a) => a.objective && !workActivities.some((w) => w.objective === a.objective),
		) ||
			gateActivities.some((a) => a.commands && a.commands.length > 0) ||
			gateActivities.some((a) => a.nextActions && a.nextActions.length > 0))
			? {
					objective: gateActivities.find(
						(a) =>
							a.objective && !workActivities.some((w) => w.objective === a.objective),
					)?.objective,
					commands: gateActivities.flatMap((a) => a.commands ?? []),
					mustNotDo: gateActivities.flatMap((a) => a.mustNotDo ?? []),
					nextActions: gateActivities.flatMap((a) => a.nextActions ?? []),
				}
			: null;

	// Resolve placeholders: <AC-ID> and <ITEM-ID>
	const pendingIds = dir.pendingACIds ?? [];
	const resolvedItemId = dir.primaryItemId ?? snapshot.primaryItemId ?? snapshot.items[0]?.id;

	const resolvedCommands: typeof aggCommands = [];
	for (const cmd of aggCommands) {
		const hasAcPlaceholder = cmd.command.includes("<AC-ID>");
		const hasItemPlaceholder = cmd.command.includes("<ITEM-ID>");

		if (hasAcPlaceholder && pendingIds.length === 0) continue;
		if (hasItemPlaceholder && !resolvedItemId) continue;

		if (hasAcPlaceholder) {
			for (const acId of pendingIds) {
				resolvedCommands.push({
					...cmd,
					command: cmd.command
						.replace("<AC-ID>", acId)
						.replace("<ITEM-ID>", resolvedItemId ?? acId),
				});
			}
		} else if (hasItemPlaceholder) {
			resolvedCommands.push({
				...cmd,
				command: cmd.command.replace("<ITEM-ID>", resolvedItemId!),
			});
		} else {
			resolvedCommands.push(cmd);
		}
	}

	const roleLabel = dir.roleIds.length > 0 ? dir.roleIds.join(", ") : null;
	const stagesLabel = stageId ?? null;
	const itemLabel = item ? `${item.id} — ${item.description} (${stageName ?? stageId})` : null;

	if (format === "at") {
		const lines: string[] = ["# harness-direction:start", "## Direção do Harness", ""];
		const metaParts = [
			version ? `@harness: ${version}` : "",
			roleLabel ? `papel: ${roleLabel}` : "",
			stagesLabel ? `estágios: ${stagesLabel}` : "",
		].filter(Boolean);
		if (metaParts.length > 0) lines.push(metaParts.join(" | "));
		if (itemLabel) lines.push(`@item: ${itemLabel}`);
		if (aggObjective) lines.push(`@objetivo: ${aggObjective}`);
		if (resolvedCommands.length > 0) {
			lines.push(`@comandos: ${resolvedCommands.map((c) => c.command).join(" | ")}`);
		}
		if (aggMustNotDo.length > 0) {
			lines.push(`@proibições: ${aggMustNotDo.join(" | ")}`);
		}
		if (aggNextActions.length > 0) {
			lines.push(
				`@proximas: ${aggNextActions
					.slice(0, 2)
					.map((a) => a.label)
					.join(" | ")}`,
			);
		}
		if (gateSub) {
			if (gateSub.objective) lines.push(`@gate: ${gateSub.objective}`);
			if (gateSub.commands.length > 0)
				lines.push(`@gate-comandos: ${gateSub.commands.map((c) => c.command).join(" | ")}`);
			if (gateSub.nextActions.length > 0)
				lines.push(
					`@gate-proximas: ${gateSub.nextActions
						.slice(0, 2)
						.map((a) => a.label)
						.join(" | ")}`,
				);
		}
		lines.push("# harness-direction:end");
		return lines.join("\n");
	}

	const body: string[] = [];

	if (roleLabel || version || stagesLabel) {
		const meta = [
			version ? `**Versão**: ${version}` : "",
			roleLabel ? `**Papel**: ${roleLabel}` : "",
			stagesLabel ? `**Estágios**: ${stagesLabel}` : "",
		]
			.filter(Boolean)
			.join(" | ");
		body.push(meta);
	}

	if (itemLabel) body.push(`**Item**: ${itemLabel}`);

	if (aggObjective) body.push(`**Objetivo**: ${aggObjective}`);

	if (resolvedCommands.length > 0) {
		body.push("**Comandos**:");
		for (const c of resolvedCommands) {
			body.push(`- \`${c.command}\` — ${c.label}`);
		}
	}

	if (aggMustNotDo.length > 0) {
		body.push(`**Proibições**: ${aggMustNotDo.join(" ")}`);
	}

	if (aggNextActions.length > 0) {
		body.push("**Próximas ações**:");
		aggNextActions.slice(0, 2).forEach((a, i) => {
			body.push(`${i + 1}. ${a.label}${a.description ? ` — ${a.description}` : ""}`);
		});
	}

	if (gateSub) {
		body.push("");
		body.push("**Gate**");
		if (gateSub.objective) body.push(`_${gateSub.objective}_`);
		if (gateSub.commands.length > 0) {
			for (const c of gateSub.commands) {
				body.push(`- \`${c.command}\` — ${c.label}`);
			}
		}
		if (gateSub.nextActions.length > 0) {
			gateSub.nextActions.slice(0, 2).forEach((a, i) => {
				body.push(
					`${i + 1 + aggNextActions.slice(0, 2).length}. ${a.label}${a.description ? ` — ${a.description}` : ""}`,
				);
			});
		}
	}

	if (body.length === 0) return null;

	return `<!-- harness-direction:start -->\n${body.join("\n")}\n<!-- harness-direction:end -->`;
}

// P6 — Comandos
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
	options: { source: AdapterSource; displayName: string },
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
			sections.push(
				`Read the following files before starting any task:\n${L1_FILES.map((p) => `- ${p}`).join("\n")}`,
			);
		}
		if (snapshot.hasFocus)
			sections[1] += format === "at" ? "\n@.letra/focus.md" : "\n- .letra/focus.md";
		sections.push(`## Referências\n\n${formatMarkdownReferences(snapshot)}`);
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

	const phase = formatPhase(snapshot);
	if (phase) {
		sections.push(`## Fase Atual\n\n${phase}`);
	}

	const dir = formatHarnessDirection(snapshot, format);
	if (dir) {
		sections.push(`## Direção do Harness\n\n${dir}`);
	}

	// Grave alerts go right after protocol
	const hasGrave = snapshot.alerts?.some((a) => a.severity === "alta");
	if (hasGrave) {
		const graveAlerts = snapshot.alerts?.filter((a) => a.severity === "alta") || [];
		sections.push(
			`## ⚠ ATENÇÃO — Problema Grave\n\n${formatAlerts({ ...snapshot, alerts: graveAlerts })}`,
		);
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

	const handoffStr = formatHandoff(snapshot);
	if (handoffStr) {
		sections.push(`## Após completar uma ação\n\n${handoffStr}`);
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
	sections.push(`## Referências\n\n${formatMarkdownReferences(snapshot)}`);

	return `${sections.join("\n\n")}\n`;
}

function formatPhase(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.currentPhase) return null;
	const p = snapshot.currentPhase;
	let out = `${p.label} — ${p.description}`;
	if (p.harness?.instructions) {
		out += `\n  Instruções: ${p.harness.instructions}`;
	}
	if (p.harness?.checks && p.harness.checks.length > 0) {
		out += `\n  Verificações:\n    ${p.harness.checks.map((c) => `- ${c}`).join("\n    ")}`;
	}
	return out;
}

function formatHandoff(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.handoff || snapshot.handoff.disabled) return null;
	const h = snapshot.handoff;
	const lines: string[] = [];
	for (const step of h.steps) {
		lines.push(`- \`${step.command}\` — ${step.label}`);
		if (step.recovery) {
			lines.push(`  ❌ Se falhar: ${step.recovery}`);
		}
	}
	if (h.nextStageName) {
		lines.push("", "Após mover, verifique o novo estágio com `letra pulse`");
	}
	return lines.join("\n");
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
