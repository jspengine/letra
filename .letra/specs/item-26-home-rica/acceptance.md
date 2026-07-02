## Acceptance Criteria

- [ ] **Métricas**: Cards de Specs (total/válidas/incompletas), Drift (desatualizadas), Foco (spec ativa), Health (stale/healthy) com tooltips explicativos
- [ ] **Pipeline visual**: Grid de stages com nome, contagem de itens, cor configurável (stage.color), badge "today"
- [ ] **Drag & drop de stages**: Stages no pipeline podem ser reordenados por drag & drop nativo HTML5 — persistido via PATCH /api/workflow
- [ ] **Mini-items no pipeline**: Cada stage mostra até 3 items recentes como mini-cards arrastáveis entre stages — PATCH /api/items/:id
- [ ] **Specs Recentes**: Grid de até 4 specs com badge de % ACs concluídas, link para Specs view
- [ ] **Decisões Recentes**: Lista das últimas 4 decisões, link para Context view
- [ ] **Métricas avançadas**: Tabela por estágio com avg days, max days, badge "bottleneck" quando avg > 5
- [ ] **Vibe styling**: Cards consistentes (border-muted/60, hover suave, stage.color como accent)
