# Spec: fullscreen-modal

> Updated: 2026-06-23

## Outcome
O modal de detalhe do item (ItemDetailModal) será full-screen, exibirá a timeline de eventos/logs do item de forma legível (não truncada), e integrará com a seção "Eventos Recentes" do dashboard para redirecionamento direto ao log do item.

## Constraints
- Full-screen = 100vw x 100vh, overlay escuro atrás
- Timeline logs vêm do `session-log.json` via `GET /api/log?item=<id>`
- Manter todas as funcionalidades atuais do modal (spec view, tasks, move, ACs)
- Fechar com ESC ou botão X no canto superior direito

## Exclusions
- Edição de logs (logs são append-only)
- Filtros avançados na timeline (coberto por ITEM-40 log-search)

## Acceptance Criteria

- [x] **AC1**: Modal ocupa 100vw x 100vh, com `position: fixed`, `z-index: 50`, overlay `var(--overlay)`. Header do modal com ID do item, stage badge, botão X (fechar), botão "Abrir Spec". Conteúdo scrollável.
- [x] **AC2**: Timeline de eventos/logs do item: seção collapsível "Log de Eventos" no modal, carregada via `GET /api/log?item=<id>`. Exibe cada entrada com timestamp, action, description (sem truncamento). Máximo 100 entradas, scrollável.
- [x] **AC3**: Seção "Eventos Recentes" no Home Dashboard exibe últimos 5 logs do item ativo com link "Ver todos →" que abre o modal no modo timeline. Logs não são truncados (ou truncados com "..." + expand via clique).
- [x] **AC4**: Transição de abertura/fechamento suave (scale 0.95 → 1 + opacity 0 → 1, 200ms ease-out).

## Context
Atualmente o modal não é full-screen, e os logs/eventos do item aparecem truncados em "Eventos Recentes" no dashboard sem que o usuário consiga ler o conteúdo completo. Isso prejudica o diagnóstico de ações passadas no item.
