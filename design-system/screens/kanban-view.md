# KanbanView (Board)

**Arquivo**: `packages/client/src/components/Kanban/KanbanView.tsx`
**Propósito**: Visualização tabular de itens do workflow, alternativa ao Flow.

## Layout
- Colunas por estágio (scroll horizontal)
- Cards compactos (3 linhas: slug/estado, agente/ação, progresso/%)
- Badge de tipo (feature, bug, chore)
- Dias em estágio com cor semântica

## Elementos principais
- `MarchingBorder` — borda animada para claims ativos
- `PhaseBadge` — badge de fase/estágio
- Slug + spec type tag

## Tokens usados
`--border`, `--border-focus`, `--card`, `--error`, `--muted`, `--muted-foreground`, `--primary`, `--warning`

## Conformidade LDL
- [x] Cards compactos com progresso (alinhado com "eficiência visual")
- [ ] Usa `@letra/ui/Button` (importa de `../../lib/utils` cn)
- [ ] Badge importa de `../ui/badge` (duplicata local) — deve migrar para `@letra/ui`
- [ ] MarchingBorder animado — alinhado com brand motion
