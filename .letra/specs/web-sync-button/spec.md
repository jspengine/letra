# Spec: web-sync-button

> Updated: 2026-06-22

## Outcome

O usuário pode sincronizar manualmente o estado do workspace diretamente da web app, sem precisar abrir o terminal. Um botão "Sync" no header dispara a reconciliação (regenera adapters, atualiza context.md, valida focus), equivalente a `letra sync` no terminal.

## Constraints

- Reusa os endpoints HTTP existentes (`POST /api/sitrep`) + re-fetch de workflow
- Não adiciona novo endpoint — apenas orquestra chamadas existentes
- Feedback visual claro de progresso e resultado (sucesso/erro)
- Não bloqueia a UI durante a execução (chamada assíncrona com polling ou SSE)
- Design consistente com o header existente

## Exclusions

- Sync automático periódico (futuro)
- Indicador de "último sync há X min" (futuro)
- Cancelamento de sync em andamento
- Botão Sync em outras páginas além do header global

## Acceptance Criteria

- [ ] **SyncButton**: Header tem botão "Sync" ao lado do badge de alertas
- [ ] **Chamada**: Ao clicar, faz `POST /api/sitrep` (endpoint já existe)
- [ ] **Feedback progresso**: Mostra estados syncing → success (com check) → idle
- [ ] **Re-fetch**: Após sync bem-sucedido, re-fetch workflow + health alerts + diagnostics
- [ ] **Error state**: Se a chamada falhar, mostra ❌ com tooltip de erro. Botão permanece clicável
- [ ] **SSE**: Não precisa — o re-fetch manual substitui
- [ ] **Estilo**: Usa tokens do design system, sem quebrar layout do header
- [ ] **Testes**: Componente testado com Vitest + mock do fetch
- [ ] **Empty state**: Funciona mesmo sem workflow (apenas mostra resultado parcial)
- [ ] **Nada quebrado**: Header existente continua funcionando normalmente

## Context

Com a introdução do `writeWorkflow()` gateway no backend, o sync manual ganha importância: o usuário pode disparar reconciliação total quando quiser, garantindo que adapters e context.md reflitam o estado atual do workflow. O endpoint `POST /api/sitrep` já existe no `flow-serve.ts`, mas não tem chamada na web app.
