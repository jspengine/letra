import type { ActivityContextAction, ActivityContextReference, ActivityKind } from "./types.js";

export interface CompatibilityIntentContext {
	specName: string | null;
	hasFocus: boolean;
	hasCurrentItem: boolean;
	review?: {
		emphasis: string;
		riskFocus?: string;
		evidencePrompt?: string;
	};
	gate?: {
		label: string;
		evidence: string;
		decision: string;
	};
}

export interface CompatibilityActivityIntent {
	objective: string;
	mustRead: ActivityContextReference[];
	mustNotDo: string[];
	nextActions: ActivityContextAction[];
}

const OBJECTIVES: Record<ActivityKind, string> = {
	design: "Definir direção, escopo e restrições da próxima mudança.",
	implement: "Executar a mudança com foco no item ativo e nos critérios da spec.",
	review: "Avaliar alinhamento entre implementação, spec, riscos e evidências.",
	diagnose: "Entender divergências, alertas e sinais operacionais do workspace.",
	gate: "Preparar uma decisão humana com evidências claras e riscos explícitos.",
};

const MUST_NOT_DO: Record<ActivityKind, string[]> = {
	design: [
		"Não implementar código sem spec e direção aprovadas.",
		"Não mover decisões estruturais sem revisão humana.",
	],
	implement: [
		"Não editar `workflow.json` manualmente.",
		"Não implementar fora do escopo da spec ativa.",
	],
	review: [
		"Não focar em novas features fora do diff/spec analisado.",
		"Não aprovar sem checar riscos, ACs e sinais ativos.",
	],
	diagnose: [
		"Não ignorar alertas de alta severidade sem registrar decisão.",
		"Não tratar sintoma sem identificar a fonte de drift.",
	],
	gate: [
		"Não avançar estágio sem evidências suficientes.",
		"Não substituir decisão humana por automação silenciosa.",
	],
};

function compatibilityReferences(
	activity: ActivityKind,
	context: CompatibilityIntentContext,
): ActivityContextReference[] {
	const references: ActivityContextReference[] = [
		{ path: ".letra/context.md", reason: "Contexto operacional do workspace" },
		{ path: ".letra/constitution.md", reason: "Regras não negociáveis do Letra" },
	];
	if (context.hasFocus) {
		references.push({ path: ".letra/focus.md", reason: "Foco e outcome da sessão atual" });
	}
	if (context.specName) {
		references.push({
			path: `.letra/specs/${context.specName}/spec.md`,
			reason: "Spec e critérios do trabalho atual",
		});
	}
	if (activity === "review" || activity === "gate") {
		references.push({
			path: ".letra/session-log.json",
			reason: "Evidências recentes e trilha operacional da sessão",
		});
	}
	if (activity === "diagnose") {
		references.push({
			path: ".letra/health-record.json",
			reason: "Estado persistente dos alertas ativos",
		});
	}
	if (!context.hasCurrentItem) {
		references.push({
			path: ".letra/workflow.json",
			reason: "Fonte de verdade para triagem e escolha do próximo item",
		});
	}
	return references;
}

function currentItemActions(
	activity: ActivityKind,
	context: CompatibilityIntentContext,
): ActivityContextAction[] {
	const specRef = context.specName ? `spec \`${context.specName}\`` : "spec ativa";
	switch (activity) {
		case "design":
			return [
				{
					label: "Revisar outcome",
					description: `Validar objetivo e bordas da ${specRef}.`,
				},
				{
					label: "Fechar restrições",
					description:
						"Transformar ambiguidades em constraints ou exclusions explícitas.",
				},
				{
					label: "Preparar decisões",
					description:
						"Listar escolhas arquiteturais ou de produto que exigem confirmação humana.",
				},
			];
		case "implement":
			return [
				{
					label: "Executar item ativo",
					description: `Implementar o próximo passo observando os ACs da ${specRef}.`,
				},
				{
					label: "Evitar drift",
					description:
						"Comparar a solução proposta com foco, contexto e regras da constitution.",
				},
				{
					label: "Checar restrições",
					description:
						"Confirmar limites de escopo antes de alterar estado, API ou arquitetura.",
				},
			];
		case "review":
			return [
				{
					label: "Comparar com spec",
					description: context.review
						? `Checar ${context.review.emphasis} contra a ${specRef}.`
						: `Checar aderência do trabalho contra a ${specRef}.`,
				},
				{
					label: "Listar riscos",
					description:
						context.review?.riskFocus ??
						"Destacar bugs, regressões e violações de processo antes de aprovar.",
				},
				{
					label: "Cobrar evidências",
					description:
						context.review?.evidencePrompt ??
						"Verificar se testes, sinais e logs recentes sustentam a revisão.",
				},
			];
		case "diagnose":
			return [
				{
					label: "Ler sinais ativos",
					description: "Inspecionar divergências entre foco, workflow e health.",
				},
				{
					label: "Definir causa raiz",
					description: "Separar problemas de estado, spec e execução.",
				},
				{
					label: "Priorizar impacto",
					description: "Atacar primeiro inconsistências que bloqueiam a atividade atual.",
				},
			];
		case "gate":
			return [
				{
					label: "Preparar evidências",
					description: context.gate
						? `Reunir ${context.gate.evidence} para ${context.gate.label.toLowerCase()}.`
						: "Reunir sinais, riscos e estado do item para decisão humana.",
				},
				{
					label: "Explicitar decisão",
					description: "Declarar claramente o que precisa ser aprovado ou bloqueado.",
				},
				{
					label: "Responder gate",
					description: context.gate
						? `Informar que a decisão esperada agora é: ${context.gate.decision}.`
						: "Informar qual aprovação humana é esperada e por quê.",
				},
			];
	}
}

export function getCompatibilityActivityIntent(
	activity: ActivityKind,
	context: CompatibilityIntentContext,
): CompatibilityActivityIntent {
	return {
		objective: OBJECTIVES[activity],
		mustRead: compatibilityReferences(activity, context),
		mustNotDo: [...MUST_NOT_DO[activity]],
		nextActions: context.hasCurrentItem
			? currentItemActions(activity, context)
			: [
					{
						label: "Triar item",
						description:
							"Escolher ou criar um item ativo antes de aprofundar a execução.",
					},
					{
						label: "Confirmar foco",
						description:
							"Validar se a sessão deve seguir descoberta, design ou backlog.",
					},
				],
	};
}
