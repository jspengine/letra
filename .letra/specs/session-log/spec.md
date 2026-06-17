# Diário de Bordo — Continuidade Entre Sessões do Agente

> Updated: 2026-06-15

## Outcome

Entre sessões do agente, nada se perde. Cada ação significativa (validate executado, AC concluído, item movido, decisão tomada, alerta reconhecido) é registrada em um diário de bordo estruturado. Quando o agente volta, ele lê o diário e sabe exatamente onde parou.

O humano também pode consultar o diário para entender o histórico de ações do agente.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Onde |
|---|---|---|
| session log | diário de bordo | `.letra/session-log.json` |
| entry | registro | Uma linha no diário |
| action type | tipo de ação | validate, ac_complete, item_move, decision, health_action |
| continuation | continuidade | Próximo passo sugerido com base no último registro |

## Constraints

- Diário é um JSON array em `.letra/session-log.json`
- Cada registro tem: id, timestamp, action, description, itemId?, acId?, details?
- Ações registradas automaticamente por comandos do Letra (validate, flow move, health ack/dismiss)
- Agente pode adicionar registros manuais via `letra log add "descrição" [--item ITEM-X] [--ac AC-003]`
- Consulta via `letra log` (últimos 10) ou `letra log --all` (completo)
- Não é um chat log — apenas ações estruturadas
- Máximo 500 registros; >500 → remove os mais antigos (FIFO)
- Versionado em git (parte do `.letra/`)

## Architecture

### Schema: `.letra/session-log.json`

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "id": "log-001",
      "timestamp": "2026-06-15T18:00:00.000Z",
      "action": "validate",
      "description": "Validação executada — 9 passed, 0 failed, 115 warnings",
      "itemId": null,
      "acId": null,
      "details": { "passed": 9, "failed": 0, "warnings": 115 }
    },
    {
      "id": "log-002",
      "timestamp": "2026-06-15T18:05:00.000Z",
      "action": "ac_complete",
      "description": "AC 'Schema health-record.json definido' concluído",
      "itemId": "ITEM-41",
      "acId": "AC-001",
      "details": { "spec": "health-record" }
    },
    {
      "id": "log-003",
      "timestamp": "2026-06-15T18:10:00.000Z",
      "action": "decision",
      "description": "Decisão: usar JSON puro sem Zod para schema validation",
      "itemId": "ITEM-41",
      "acId": null,
      "details": { "decisionFile": ".letra/decisions/json-schema-sem-zod.md" }
    },
    {
      "id": "log-004",
      "timestamp": "2026-06-15T18:15:00.000Z",
      "action": "item_move",
      "description": "ITEM-41 movido: Code → Review",
      "itemId": "ITEM-41",
      "acId": null,
      "details": { "from": "code", "to": "review" }
    },
    {
      "id": "log-005",
      "timestamp": "2026-06-15T18:20:00.000Z",
      "action": "manual",
      "description": "Implementei load/save do health-record. Resta API REST e CLI. Parei no meio porque sessão ficou longa.",
      "itemId": "ITEM-41",
      "acId": null,
      "details": {}
    }
  ]
}
```

### Tipos de Ação

| action | Gerado por | Descrição |
|---|---|---|
| `validate` | `letra validate` (automático) | Resultado da validação |
| `diagnose` | `letra diagnose` (automático) | Resultado do diagnóstico |
| `health_scan` | `letra health scan` (automático) | Scan de saúde executado |
| `health_ack` | `letra health ack` (automático) | Alerta reconhecido |
| `health_dismiss` | `letra health dismiss` (automático) | Alerta descartado |
| `ac_complete` | `letra log ac AC-003 --item ITEM-41` (agente) | AC concluído |
| `item_move` | `letra flow move` (automático) | Item movido entre estágios |
| `decision` | `letra decision new` (automático) | Decisão registrada |
| `sitrep` | `letra sitrep` (automático) | Contexto atualizado |
| `focus_set` | `letra focus` (automático) | Foco definido |
| `manual` | `letra log add "..."` (agente) | Registro manual do agente |
| `session_end` | `letra log session-end` (agente) | Fim de sessão |

### Comandos CLI

```
letra log                      → Últimos 10 registros (resumo)
letra log --all                → Todos os registros
letra log --item ITEM-41       → Registros de um item específico
letra log --action validate    → Registros de um tipo específico
letra log --since 2026-06-01   → Registros desde uma data
letra log add "mensagem"       → Registro manual
letra log add "mensagem" --item ITEM-41 --ac AC-003
letra log ac AC-003 --item ITEM-41  → Atalho para AC concluído
letra log session-end          → Marca fim de sessão

Formato JSON:
letra log --json               → Últimos 10 em JSON
letra log --all --json         → Todos em JSON
```

### Integração com Outros Comandos

Outros comandos do Letra registram automaticamente no diário:

```typescript
// hooks.ts — registra automaticamente em comandos chave
function onValidateComplete(result: ValidateResult) {
  logEntry("validate", `Validação executada — ${result.passed} passed`, {
    passed: result.passed,
    failed: result.failed,
    warnings: result.warnings,
  });
}

function onItemMoved(itemId: string, from: string, to: string) {
  logEntry("item_move", `ITEM-${itemId} movido: ${from} → ${to}`, {
    itemId,
    from,
    to,
  });
}

function onHealthAck(entryId: string) {
  logEntry("health_ack", `Alerta ${entryId} reconhecido`, { entryId });
}
```

### Uso pelo Agente: Continuidade

```markdown
## Continuidade entre Sessões

Quando iniciar uma sessão:

1. Leia o diário: `letra log --since "2026-06-14" --json`
   → Veja onde parou na sessão anterior
   → Identifique o último AC trabalhado
   → Veja decisões tomadas na sessão anterior

2. Se o último registro é `session_end`:
   → Comece do item que estava ativo
   → Verifique o progresso: `letra pulse`

3. Se NÃO há `session_end` (sessão interrompida):
   → Retome exatamente de onde parou
   → O último registro manual diz "parei no meio do AC-003"
```

## Acceptance Criteria

- [ ] **session-log.json**: Criado em `.letra/` após primeira ação registrável
- [ ] **Registro automático**: validate, flow move, health ack/dismiss, decision new, sitrep registram automaticamente
- [ ] **Registro manual**: `letra log add "mensagem"` adiciona entrada manual
- [ ] **AC completo**: `letra log ac AC-003 --item ITEM-41` registra AC concluído
- [ ] **Fim de sessão**: `letra log session-end` marca término
- [ ] **Consulta**: `letra log` mostra últimos 10 registros formatados
- [ ] **--all**: Mostra todos os registros
- [ ] **--json**: Saída JSON para consumo por agente
- [ ] **--item**: Filtra por item
- [ ] **--action**: Filtra por tipo de ação
- [ ] **--since**: Filtra por data
- [ ] **Limite FIFO**: Máximo 500 registros; mais antigos removidos
- [ ] **Schema**: Versão 1 com campos id, timestamp, action, description, itemId, acId, details
- [ ] **API GET /api/log**: Retorna registros em JSON (últimos 50, com query params)
- [ ] **Testes**: Registro automático, registro manual, filtros, limite FIFO, consulta

## Exclusions

- Chat log ou transcripts de conversa — apenas ações estruturadas
- Histórico de edições de arquivo (diff) — isso é responsabilidade do git
- Métricas ou analytics — apenas registro factual

## Context

O diário de bordo é o que permite continuidade real entre sessões. Sem ele, o agente começa do zero toda vez — precisa re-descobrir o estado, re-avaliar o que falta, e não sabe o que já foi tentado.

A combinação session-log + health-record + workflow.json forma a memória completa do Letra:
- workflow.json: O que precisa ser feito
- health-record: O que está errado
- session-log: O que já foi feito

Desses três, o session-log é o único que não existia antes deste spec.
