# Spec: Diagnostics Web

> Updated: 2026-06-14

## Outcome

O `flow serve` expõe os resultados do Self-Diagnosis Engine via SSE e REST. A UI (ou qualquer cliente HTTP) recebe notificações em tempo real de auto-correções aplicadas e sugestões disponíveis, além de endpoints para disparar scan manual e executar rollback.

## Constraints

- Zero dependências externas — apenas `node:http` (já usado pelo flow-serve)
- SSE usa mesmo mecanismo existente (broadcast de eventos com `event:` + `data:`)
- Nenhum endpoint de diagnóstico pode quebrar o fluxo normal do servidor
- Snapshot restore deve ser atômico — ou restaura tudo ou nada

## API

### SSE Events (canal `/events`)

```json
event: diagnostics-updated
data: { "fixes": 2, "suggestions": 1, "snapshots": [ "1718300000_ac-stale" ] }
```

### REST Endpoints

```
GET  /api/diagnostics
  → { "fixes": Diagnostic[], "suggestions": Diagnostic[], "timestamp": "..." }

GET  /api/diagnostics/snapshots
  → { "snapshots": SnapshotSummary[] }   // lista para undo history

POST /api/diagnostics/scan
  → re-executa engine.runAll(), força SSE broadcast
  → { "fixes": [...], "suggestions": [...] }

POST /api/diagnostics/undo/:snapshotId
  → restaura arquivos do snapshot
  → { "ok": true, "restoredFiles": ["..."], "snapshotId": "..." }
```

## Acceptance Criteria

- [ ] **SSE event `diagnostics-updated`**: Toda vez que engine.runAll() completa, servidor emite evento no canal SSE com resumo (contagem de fixes, sugestões, snapshots)
- [ ] **GET /api/diagnostics**: Retorna JSON com arrays `fixes` (auto-corrigidos) e `suggestions` (pendentes de ação), cada item com `{ id, type, title, description, snapshotId? }`
- [ ] **GET /api/diagnostics/snapshots**: Retorna lista de snapshots com `{ id, timestamp, diagnostic, files: [{ path, beforeSize, afterSize }] }`
- [ ] **POST /api/diagnostics/scan**: Re-executa engine.runAll(), retorna resultados, emite SSE
- [ ] **POST /api/diagnostics/undo/:snapshotId**: Restaura arquivos do snapshot, retorna `{ ok: true, restoredFiles, snapshotId }`
- [ ] **Undo atômico**: Se restore falhar em um arquivo, nenhum arquivo é modificado (transacional)
- [ ] **Snapshot inválido**: Se snapshotId não existe, retorna 404 sem modificar nada
- [ ] **Sem degradação**: Rodar scan manual ou receber SSE não afeta tempo de resposta de outras rotas

## Exclusions

- Autenticação ou autorização — servidor local, sem necessidade
- Cache ou rate limiting de SSE — poucos eventos, clientes leves
- Endpoint para configurar quais detectores rodam — configuração via config.json (futuro)

## Context

Este spec é puramente a camada de transporte. A lógica de diagnóstico está no spec self-diagnosis-core. A UI está no spec diagnostics-ui. Separar as camadas permite que a engine rode em modo CLI sem servidor (via `letra diagnose`), e que o servidor seja substituído sem perder as outras duas camadas.
