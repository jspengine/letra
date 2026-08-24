const ACTION_LABELS: Record<string, string> = {
	// AC actions
	ac_done: "Critério concluído",
	ac_complete: "Critério concluído",

	// Item actions
	item_move: "Item movido",
	item_release: "Item liberado",

	// Spec actions
	spec_create: "Especificação criada",
	spec_update: "Especificação atualizada",

	// Validate
	validate: "Validação",
	diagnose: "Diagnóstico",

	// Health
	health_scan: "Verificação de saúde",
	health_ack: "Alerta reconhecido",
	health_dismiss: "Alerta descartado",

	// Focus
	focus_set: "Foco definido",
	focus_sync: "Foco sincronizado",
	focus_clear: "Foco limpo",

	// Decision
	decision: "Decisão registrada",

	// Sitrep
	sitrep: "Situação atualizada",

	// System
	system: "Automação",
	manual: "Ação manual",

	// Session
	session_end: "Sessão encerrada",

	// Agent direction
	agent_direction_read: "Direção consultada",
	agent_validation_run: "Validação executada",
	agent_ac_completion_requested: "Conclusão solicitada",
	agent_transition_requested: "Transição solicitada",
	agent_operation_rejected: "Operação rejeitada",

	// Flow
	flow_move: "Movimento no fluxo",
	flow_init: "Fluxo inicializado",
	flow_import: "Fluxo importado",
	flow_export: "Fluxo exportado",

	// Harness
	harness_load: "Configuração carregada",

	// MCP
	mcp_serve: "MCP iniciado",

	// Workspace
	workspace_init: "Ambiente inicializado",
	workspace_switch: "Ambiente alternado",
} as const;

export function translateAction(action: string): string {
	return ACTION_LABELS[action] || action;
}

export function actionVariant(action: string): "success" | "amber" | "info" {
	if (
		action.includes("move") ||
		action.includes("approve") ||
		action.includes("create") ||
		action.includes("done") ||
		action.includes("complete")
	)
		return "success";
	if (
		action.includes("reject") ||
		action.includes("fail") ||
		action.includes("error") ||
		action.includes("dismiss")
	)
		return "amber";
	return "info";
}
