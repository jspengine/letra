import type { AdapterFormat, HarnessSnapshot } from "./types.js";

const L1_FILES = [".letra/context.md", ".letra/constitution.md", ".letra/glossary.md"] as const;

function formatL1(snapshot: HarnessSnapshot, format: AdapterFormat): string {
	if (format === "at") {
		const lines = ["# Context", ...L1_FILES.map((path) => `@${path}`)];
		if (snapshot.hasFocus) lines.push("@.letra/focus.md");
		return lines.join("\n");
	}

	const lines = [
		"Read the following files before starting any task:",
		...L1_FILES.map((path) => `- ${path}`),
	];
	if (snapshot.hasFocus) {
		lines.push("- .letra/focus.md (defines current session focus)");
	} else {
		lines.push("- .letra/focus.md (if exists, defines current session focus)");
	}
	return lines.join("\n");
}

function formatL2(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.hasWorkflow || !snapshot.activeStage) return null;

	const itemsBlock =
		snapshot.items.length > 0
			? snapshot.items
					.map((item) => {
						let line = `- ${item.id}: ${item.description}`;
						if (item.spec) {
							line += `\n  - spec: ${item.specPath}\n  - acceptance: ${item.acceptancePath}`;
						}
						return line;
					})
					.join("\n")
			: "(nenhum item ativo neste estagio)";

	return `## Workflow

**Estagio atual:** ${snapshot.activeStage.name}

### Itens neste estagio

${itemsBlock}`;
}

function formatL3(snapshot: HarnessSnapshot): string | null {
	if (!snapshot.hasWorkflow) return null;

	const primaryItem = snapshot.items.find((i) => i.id === snapshot.primaryItemId);
	const primaryLine = primaryItem
		? `**Item primario:** ${primaryItem.id}${primaryItem.spec ? ` (${primaryItem.spec})` : ""}`
		: "**Item primario:** nenhum";

	let acPending = 0;
	let acTotal = 0;
	let tasksOpen = 0;
	let tasksTotal = 0;

	if (primaryItem) {
		acPending = primaryItem.acPending ?? 0;
		acTotal = primaryItem.acTotal ?? 0;
		tasksOpen = primaryItem.tasksOpen ?? 0;
		tasksTotal = primaryItem.tasksTotal ?? 0;
	}

	const lines = [
		"## Sinais de trabalho",
		"",
		primaryLine,
		`**ACs:** ${acPending}/${acTotal} pendentes`,
		`**Tasks:** ${tasksOpen}/${tasksTotal} abertas`,
	];

	if (primaryItem?.spec && snapshot.acDrifts) {
		const drift = snapshot.acDrifts.find((d) => d.spec === primaryItem.spec);
		if (drift) {
			lines.push(
				`⚠ ac-source-drift: spec.md=${drift.specCount}, acceptance.md=${drift.acceptanceCount}`,
			);
		}
	}

	return lines.join("\n");
}

function formatRules(snapshot: HarnessSnapshot): string {
	if (snapshot.hasWorkflow) {
		return `## Regras

- Leia as specs em .letra/specs/ antes de codificar
- Execute \`letra validate\` para verificar acceptance criteria
- Siga a constitution.md rigorosamente
- Ao concluir, mova o item com \`letra flow move <id> --to <proximo_estagio>\``;
	}

	return `# Rules
- Always read specs in .letra/specs/ before writing code
- Run \`letra validate\` to check acceptance criteria
- Follow the constitution.md rules strictly
- Use formal tone in all generated content`;
}

export function formatAdapterContent(
	snapshot: HarnessSnapshot,
	format: AdapterFormat,
	options: { source: "init" | "flow-move" | "focus"; displayName: string },
): string {
	const title = snapshot.hasWorkflow
		? `# Letra Context — ${snapshot.workflowName}`
		: `# Letra Context — ${options.displayName} Adapter`;

	const sections = [title, formatL1(snapshot, format)];

	const l2 = formatL2(snapshot);
	if (l2) sections.push(l2);

	const l3 = formatL3(snapshot);
	if (l3) sections.push(l3);

	sections.push(formatRules(snapshot));

	return `${sections.join("\n\n")}\n`;
}
