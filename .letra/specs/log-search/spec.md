# Spec: log-search

> Updated: 2026-06-23

## Outcome
Uma página de busca textual de logs no webapp, permitindo pesquisar por qualquer atributo dos registros do `session-log.json` com paginação e filtros por spec/item/action.

## Constraints
- Fonte de dados: `GET /api/log` (já existe com query params `?item=&action=&since=&search=&page=&limit=`)
- Paginação: 50 registros por página, com contagem total
- Search: full-text sobre description, action, itemId, acId
- Filtros: por item (autocomplete com IDs do workflow), por action (dropdown: system, flow-move, validate, decision), por período (since)

## Exclusions
- Logs em tempo real (SSE já cobre)
- Exportação de logs (CSV/JSON)
- Deleção de logs (append-only)

## Acceptance Criteria

- [x] **AC1**: Nova aba "Logs" no NavTabs (ao lado de Home, Specs, Flow, Context). Ícone: `search` ou `list`. Visível apenas quando workflow existe.
- [x] **AC2**: Campo de busca textual no topo com debounce 300ms. Placeholder: "Buscar em todos os logs...". Resultados atualizados via `GET /api/log?search=<query>&page=1&limit=50`.
- [x] **AC3**: Seção de filtros abaixo da busca: dropdown "Item" (autocomplete com IDs do `workflow.json`), dropdown "Ação" (enum: system, flow-move, validate, decision), input "Data início" (date picker nativo). Filtros combináveis via query params.
- [x] **AC4**: Lista de resultados: cada entrada mostra timestamp (formatado), action (badge colorido: validate=blue, flow-move=amber, system=green, decision=purple), description (sem truncamento), itemId (link clicável que abre o modal full-screen daquele item).
- [x] **AC5**: Paginação no rodapé: "Mostrando X-Y de Z" + botões Anterior/Próximo. Parâmetros `page` e `limit` na URL (sem router, usar state). Quando `limit` é omitido, default 50.

## Context
Os logs do session-log.json são ricos em dados mas só acessíveis via CLI (`letra log`). A página de busca traz essa visibilidade para o webapp, permitindo que usuários não-técnicos e agentes naveguem pelo histórico de ações de forma intuitiva.
