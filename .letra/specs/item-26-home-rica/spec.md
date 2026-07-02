# Spec: item-26-home-rica

> Updated: 2026-06-22

## Outcome

Home do flow serve transformada em dashboard visual e interativa: métricas de saúde do projeto (specs, drift, foco, health), pipeline com drag & drop (reordenar stages e mover itens entre stages), specs recentes, decisões recentes, e métricas avançadas por estágio.

## Constraints

- Modelo de dados Workflow/Item/Stage existente não pode ser alterado
- Drag & drop nativo HTML5 mantido (sem novas deps)
- Reutilizar componentes Vibe-inspired de `@letra/ui`
- SSE broadcast já existe — usar para live updates após drag

## Exclusions

- Não alterar Flow/Kanban views
- Não adicionar gráficos (será ITEM-10)
- Não adicionar automações (será ITEM-7)

## Acceptance Criteria

- [ ] **Métricas**: Cards de Specs (total/válidas/incompletas), Drift (desatualizadas), Foco (spec ativa), Health (stale/healthy) com tooltips explicativos
- [ ] **Pipeline visual**: Grid de stages com nome, contagem de itens, cor configurável (stage.color), badge "today"
- [ ] **Drag & drop de stages**: Stages no pipeline podem ser reordenados por drag & drop nativo HTML5 — persistido via PATCH /api/workflow
- [ ] **Mini-items no pipeline**: Cada stage mostra até 3 items recentes como mini-cards arrastáveis entre stages — PATCH /api/items/:id
- [ ] **Specs Recentes**: Grid de até 4 specs com badge de % ACs concluídas, link para Specs view
- [ ] **Decisões Recentes**: Lista das últimas 4 decisões, link para Context view
- [ ] **Métricas avançadas**: Tabela por estágio com avg days, max days, badge "bottleneck" quando avg > 5
- [ ] **Vibe styling**: Cards consistentes (border-muted/60, hover suave, stage.color como accent)

## Context

A Home atual já tem métricas, pipeline visual, specs recentes e decisões. Falta interatividade: drag & drop de stages (reordenar) e de mini-items (mover entre stages rapidamente). Além disso, a estilização Vibe precisa ser aplicada consistentemente.
