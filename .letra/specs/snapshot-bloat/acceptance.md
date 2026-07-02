## Acceptance Criteria

- [x] **Detector snapshot-bloat**: Mede payload JSON de snapshots, alerta se > 50KB
- [x] **Paginação na API**: `GET /api/diagnostics/snapshots?limit=10&offset=0` retorna subconjunto + `total`
- [x] **Default sem paginação**: Sem parâmetros, mantém comportamento atual (lista completa)
- [x] **Testes**: Teste de detector com mock de snapshots grandes; teste de rota com/sem paginação
