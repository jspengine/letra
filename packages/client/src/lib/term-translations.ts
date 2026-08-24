const TERM_MAP: Record<string, string> = {
	// Specs
	spec: "Especificação",
	Spec: "Especificação",
	specs: "Especificações",
	Specs: "Especificações",
	"spec name": "Nome da especificação",
	"spec linked": "Especificação vinculada",
	"no spec": "Sem especificação",

	// Harness
	harness: "Configuração",
	Harness: "Configuração",
	"harness ativo": "Configuração ativa",
	"harness data": "Dados da configuração",

	// AC / Acceptance Criteria
	AC: "Critério",
	ACs: "Critérios",
	"Acceptance Criteria": "Critérios de aceite",
	"acceptance criteria": "Critérios de aceite",

	// Gate
	gate: "Aprovação",
	Gate: "Aprovação",
	"gate pending": "Aprovação pendente",

	// Flow / Workflow
	flow: "Fluxo",
	Flow: "Fluxo",
	workflow: "Fluxo de trabalho",
	Workflow: "Fluxo de trabalho",

	// Stages
	stage: "Estágio",
	Stage: "Estágio",
	stages: "Estágios",
	Stages: "Estágios",

	// Agent / Human
	Agent: "Agente",
	agent: "Agente",
	Human: "Humano",
	human: "Humano",

	// Workspace
	workspace: "Ambiente",
	Workspace: "Ambiente",

	// Item
	item: "Item",
	Item: "Item",

	// Tasks
	Tasks: "Tarefas",
	tasks: "Tarefas",

	// Layers (HarnessViewer)
	"Core Context": "Contexto Principal",
	"Focus & Spec": "Foco e Especificação",
	"Signals & State": "Sinais e Estado",
	"Constraints & Rules": "Restrições e Regras",

	// English UI text
	Loading: "Carregando",
	"Loading...": "Carregando...",
	Copy: "Copiar",
	"Copy harness data": "Copiar dados da configuração",
	"Created today": "Criado hoje",
	"View Spec": "Ver especificação",
	Move: "Mover",
	"Select stage": "Selecionar estágio",
} as const;

export function translateTerm(term: string): string {
	return TERM_MAP[term] || TERM_MAP[term.toLowerCase()] || term;
}

export function translateSubjectType(type: string): string {
	const labels: Record<string, string> = {
		item: "Item",
		spec: "Especificação",
		ac: "Critério",
		gate: "Aprovação",
		workspace: "Ambiente",
		execution: "Execução",
		artifact: "Artefato",
	};
	return labels[type] || type;
}
