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
