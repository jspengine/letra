# HomeView

**Arquivo**: `packages/client/src/components/Home/HomeView.tsx`
**Propósito**: Dashboard principal com pipeline de estágios, health cards, gates pendentes e itens em foco.

## Layout
- Pipeline visual horizontal no topo (estágios com status)
- Grid de cards: Health, Gates, Atividades recentes
- Tabela de itens por estágio com avg days e bottleneck badge

## Elementos principais
- `PipelineStatus` — barra de progresso horizontal por estágio
- `GateCard` — cards de gate com status (waiting/available/approved/blocked)
- `MetricCards` — cards de métricas (itens ativos, gates, saúde)
- DropdownMenu para ações rápidas

## Tokens usados
`--border`, `--card`, `--foreground`, `--gate-blocked`, `--gate-waiting`, `--muted`, `--muted-foreground`, `--primary`, `--success`, `--warning`

## Conformidade LDL
- [x] Usa tokens semânticos (`@letra/ui`)
- [ ] Pipeline visual alinhado com conceito `●──●──●──◆` da marca
- [ ] Amber usado como acento operacional, não dominante
- [ ] Dark mode como padrão
- [ ] Tipografia Inter via componentes
- [ ] Usa Badge/Card/Progress do `@letra/ui`
