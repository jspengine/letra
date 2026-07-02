# AuditLogView & LogSearchView

**Arquivos**: `packages/client/src/components/Logs/AuditLogView.tsx`, `LogSearchView.tsx`
**Propósito**: Auditoria e busca de logs de eventos do workflow.

## Layout (AuditLogView)
- Tabela de logs com colunas: timestamp, ação, ator, alvo
- Paginação
- Filtro por texto e tipo de ação

## Layout (LogSearchView)
- Campo de busca com debounce
- Filtros por item, ação, data
- Resultados paginados com badges coloridos por tipo de ação
- Sugestão de itens do workflow

## Elementos principais
- Data table com badges de tipo de ação
- Pagination controls
- Search input com autocomplete
- Filtros combinados

## Tokens usados
`--background`, `--border`, `--card`, `--error`, `--foreground`, `--info`, `--muted-foreground`, `--primary`, `--success`, `--warning`

## Conformidade LDL
- [x] Badges coloridos por tipo de ação (alinhado com "cor semântica para estado")
- [x] Ações com `var(--success)`, `var(--error)`, etc. — semanticamente corretas
- [ ] Raw `<input>` nos campos de busca — migrar para Input de `@letra/ui`
- [ ] Raw `<button>` na paginação — migrar para Button
- [ ] AuditLogView não usa `@letra/ui/Badge` em todos os badges
