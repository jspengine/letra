# FlowView (Mission Control)

**Arquivo**: `packages/client/src/components/Flow/FlowView.tsx`
**Propósito**: Mission Control — orquestração de agentes, kanban por estágio, pipeline visual e timeline.

## Layout
- Header "Mission Control" com botões (Add, Sync, Stages Edit, Webhooks)
- Executive Summary: 6 cards (agentes ativos, itens por estágio, bottlenecks, gates)
- Agent Control Center: cards de agentes com status + ações
- Pipeline visual horizontal com barras por estágio
- Quick filters (chips com contadores)
- KanbanBoard (colunas por estágio, scroll horizontal)
- ActivityTimeline (agrupada Hoje/Ontem/Semana)

## Elementos principais
- `ExecutiveSummary` — 6 metric cards compactos
- `AgentControlPanel` — cards de agente com status pulse
- `PipelineVisual` — barras de progresso horizontal
- `KanbanBoard` — colunas dinâmicas por estágio com cards compactos
- `ActivityTimeline` — timeline colorida por tipo de agente
- `FilterChips` — botões de filtro com contagem

## Tokens usados
`--background`, `--border`, `--card`, `--error`, `--foreground`, `--gate-available`, `--live`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--success`, `--warning`

## Conformidade LDL
- [x] Layout Mission Control (alinhado com brand: "orquestração confiável")
- [x] Pipeline visual segue conceito `●──●──●──◆`
- [x] Amber como acento operacional
- [x] Agentes com cores semânticas (amber=Claude, green=GPT, purple=Gemini)
- [x] Usa Avatar/Badge/Progress/Separator de `@letra/ui`
- [ ] Gate columns com pulse CTA "Aprovar todos" — visual alinhado com brand motion
