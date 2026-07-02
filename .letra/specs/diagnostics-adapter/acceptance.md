## Acceptance Criteria

- [ ] **L5 condicional**: Seção não aparece quando `snapshot.diagnostics` é vazio ou não tem "new"
- [ ] **Formato text**: bullet list com ID, título, tipo e instrução de ack
- [ ] **Formato at**: `@` prefix com ID e título
- [ ] **Integração builder**: `buildHarnessSnapshot` aceita `diagnostics?: DiagnosticState` opcional
- [ ] **Integração formatters**: `formatAdapterContent` chama `formatDiagnostics()` se houver dados
- [ ] **Integração flow-move**: `flowMove()` carrega DiagnosticState e passa para generateAdapters
- [ ] **Fallback silencioso**: Sem diagnostics-state.json, gera adaptador normal sem L5
- [ ] **Testes**: L5 aparece com 1 entrada "new", não aparece com 0 entradas, formato at vs text
- [ ] **Limite**: Máximo 5 entradas "new" no L5 (para não poluir o adapter); excedente vira "... e mais N"
