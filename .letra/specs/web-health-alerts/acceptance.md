## Acceptance Criteria

- [ ] **HealthBadge**: Header mostra 🔔 com contagem de alertas `status === "novo"`
- [ ] **HealthBadge dropdown**: Ao clicar, mostra preview dos 3 primeiros alertas + link "Ver todos"
- [ ] **HealthCard**: Home Dashboard mostra 4º card "Saúde" com total de alertas ativos
- [ ] **AlertList**: Página/expansão com lista completa, filtrável por status
- [ ] **Ack**: Botão "ack" altera status de "novo" para "ciente" via `POST /api/health/ack`
- [ ] **Dismiss**: Botão "dismiss" altera status para "descartado" via `POST /api/health/dismiss`
- [ ] **SSE**: Ao receber `diagnostics-updated`, re-fetch alerts automaticamente
- [ ] **Empty state**: Sem alertas, mostra "✅ Nenhum alerta" no card e badge oculto
- [ ] **Estilo**: Usa cores do design system (severity: alta → red, média → amber, info → blue)
- [ ] **Testes**: Componentes testados com Vitest + React Testing Library
- [ ] **Nada quebrado**: DiagnosticsIndicator existente continua funcionando normalmente
