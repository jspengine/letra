# Spec: Snapshot Bloat Detector + Pagination

> Updated: 2026-06-15

## Outcome

A resposta de `GET /api/diagnostics/snapshots` serializa o conteúdo completo de cada arquivo (`before`/`after` como strings). Com 20 snapshots, a resposta excede dezenas de KB. Implementar paginação e/ou detector que alerta quando o payload cresce demais.

## Constraints

- Nova rota opcional: `GET /api/diagnostics/snapshots?limit=10&offset=0` (default mantém atual para retrocompatibilidade)
- Novo detector `snapshot-bloat` com certainty 0.9 (auto-fix sugerindo paginação via header `Warning`)
- O detector alerta quando `listSnapshots()` retorna resposta serializada > 50KB em JSON

## Architecture

```
detectors/snapshot-bloat.ts
  → Serializa snapshots em memória, mede bytes
  → Se > 50KB, emite warning com sugestão de habilitar paginação

flow-serve.ts
  → GET /api/diagnostics/snapshots aceita ?limit e ?offset
  → Quando paginado, retorna { snapshots, total, limit, offset }
```

## Acceptance Criteria

- [x] **Detector snapshot-bloat**: Mede payload JSON de snapshots, alerta se > 50KB
- [x] **Paginação na API**: `GET /api/diagnostics/snapshots?limit=10&offset=0` retorna subconjunto + `total`
- [x] **Default sem paginação**: Sem parâmetros, mantém comportamento atual (lista completa)
- [x] **Testes**: Teste de detector com mock de snapshots grandes; teste de rota com/sem paginação

## Exclusions

- Compressão gzip no servidor (já feita pelo Node http module)
- Store de snapshots em formato diff (fora de escopo)
- UI de paginação no frontend (fica para spec separado)

## Context

Payload grande é um problema real: cada snapshot armazena `before`/`after` completos de arquivos como `icon.tsx` (~3KB cada). Com 20 snapshots, o JSON chega a ~120KB. Paginação resolve para a API; o detector alerta preventivamente.
