# Spec: Diagnostics State — Estado Persistente do Diagnóstico

> Updated: 2026-06-15

## Outcome

O diagnóstico tem memória. Sugestões não são mais efêmeras — cada resultado tem ciclo de vida (new → seen → acknowledged → dismissed → resolved). O agente e o usuário sabem o que mudou desde a última execução, o que já foi analisado, e o que precisa de ação.

## Constraints

- Zero dependências externas — apenas `node:fs` (JSON em `.letra/diagnostics-state.json`)
- Compatível com engine.runAll() existente — nenhuma mudança no loop principal
- Estado não bloqueia scan — sugestões "acknowledged"/"dismissed" continuam sendo geradas, mas ocultas por padrão
- Schema versionado para permitir migrações futuras
- TTL de 90 dias para entradas resolvidas/dismissed (cleanup automático)

## Architecture

```
DiagnosticEngine.runAll()
    ↓
Result[] mergeado com DiagnosticState:
    ├── Result.id novo?                 → status: "new"
    ├── Result.id existente como "new"? → status: "new" (atualiza lastSeenAt)
    ├── Result.id existente como "ack"? → status: "acknowledged" (não mostra)
    └── Result.id existente como "dismissed" com mesmo description?
                                          → status: "dismissed" (não mostra, nem gasta I/O)
    ↓
DiagnosticState persistido em .letra/diagnostics-state.json
    ↓
API REST:
    GET  /api/diagnostics/state         → { new: [...], acknowledged: [...], dismissed: [...] }
    POST /api/diagnostics/state/ack/:id → marca como acknowledged
    POST /api/diagnostics/state/dismiss/:id → marca como dismissed { reason }
    POST /api/diagnostics/state/resolve/:id → marca como resolved (auto após auto-fix bem-sucedido)

CLI:
    letra diagnostics state             → mostra estado (novos primeiro)
    letra diagnostics ack <id>          → alias para state/ack
    letra diagnostics dismiss <id>      → alias para state/dismiss
```

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

## Exclusions

- Mudança no engine.runAll() loop — merge é pós-processamento, não modifica o fluxo de auto-fix
- Histórico de decisões (apenas estado binário acknowledged/dismissed)
- Validação de motivo do dismiss (aceito qualquer string)

## Context

Esse spec fecha o principal gap identificado no relatório harness-improvement-report: diagnóstico sem memória. Sem estado persistente, as mesmas sugestões aparecem a cada scan, levando o agente a ignorá-las. Com estado, o agente vê apenas o que é novo.
