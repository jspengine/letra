## Acceptance Criteria

- [ ] **Schema**: `DiagnosticState` define interface com `schemaVersion: 1`, `lastScanAt`, `entries[]`
- [ ] **Merge**: `engine.runAll()` mescla resultados com estado anterior — IDs já conhecidos não são duplicados
- [ ] **Persistência**: Estado salvo em `.letra/diagnostics-state.json` após cada scan
- [ ] **API ack**: `POST /api/diagnostics/state/ack/:id` retorna 200 e persiste mudança
- [ ] **API dismiss**: `POST /api/diagnostics/state/dismiss/:id` aceita `{ reason }` opcional
- [ ] **Ocultação**: Sugestões "acknowledged"/"dismissed" não aparecem no output padrão (exibir com `--all`)
- [ ] **Cleanup**: Entradas "resolved"/"dismissed" com >90 dias são removidas
- [ ] **CLI diagnostics state**: Comando imprime estado formatado com contagem new/ack/dismissed
- [ ] **CLI diagnostics ack/dismiss**: Atalhos para marcar entradas sem API
- [ ] **Testes**: Merge de 3 cenários (novo, repetido, mudou), persistência, API ack/dismiss
