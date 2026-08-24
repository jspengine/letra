# DashboardView, GateCard & MetricCards

**Arquivos**: `packages/client/src/components/Dashboard/DashboardView.tsx`, `GateCard.tsx`, `MetricCards.tsx`
**Propósito**: Visão geral do workspace — colunas todo/doing/done com métricas e gates.

## Layout
- 3 colunas (Todo / Doing / Done) com cards de item
- Cada card: slug, tasks bar, dias em estágio
- Pipeline vertical de estágios
- Gate cards com status pulse
- Metric cards (counters)

## Elementos principais
- `DashColumn` — coluna vertical de itens
- `GateCard` — card de gate com pulse animation
- `MetricCards` — cards de métrica numérica
- `PipelineStatus` — barra de pipeline horizontal

## Tokens usados
`--gate-approved`, `--gate-available`, `--gate-blocked`, `--gate-waiting`, `--muted-foreground`, `--error`, `--success`, `--border`, `--muted`, `--primary`

## Conformidade LDL
- [x] Gate cards com pulse animation (alinhado com brand motion)
- [x] Cores semânticas por estado de gate
- [x] Tasks bar visual — progresso operacional
- [ ] Importa de `../ui/card` e `../ui/badge` (duplicatas locais) — deve ser `@letra/ui`
- [ ] Raw classes Tailwind — deve usar tokens
- [ ] PipelineStatus com `var(--gate-blocked)` etc. — semântica correta
