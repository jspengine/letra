## Acceptance Criteria

- [ ] **SSE event `diagnostics-updated`**: Toda vez que engine.runAll() completa, servidor emite evento no canal SSE com resumo (contagem de fixes, sugestões, snapshots)
- [ ] **GET /api/diagnostics**: Retorna JSON com arrays `fixes` (auto-corrigidos) e `suggestions` (pendentes de ação), cada item com `{ id, type, title, description, snapshotId? }`
- [ ] **GET /api/diagnostics/snapshots**: Retorna lista de snapshots com `{ id, timestamp, diagnostic, files: [{ path, beforeSize, afterSize }] }`
- [ ] **POST /api/diagnostics/scan**: Re-executa engine.runAll(), retorna resultados, emite SSE
- [ ] **POST /api/diagnostics/undo/:snapshotId**: Restaura arquivos do snapshot, retorna `{ ok: true, restoredFiles, snapshotId }`
- [ ] **Undo atômico**: Se restore falhar em um arquivo, nenhum arquivo é modificado (transacional)
- [ ] **Snapshot inválido**: Se snapshotId não existe, retorna 404 sem modificar nada
- [ ] **Sem degradação**: Rodar scan manual ou receber SSE não afeta tempo de resposta de outras rotas
