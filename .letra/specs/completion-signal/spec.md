# Sinal de Conclusão — Quando o Agente Deve Parar

> Updated: 2026-06-15

## Outcome

O agente sabe exatamente quando parar de trabalhar e como sinalizar conclusão para o humano. Não fica em loop infinito processando um backlog vazio. Não move itens que não deveria. No fim de cada sessão, produz um relato do que fez e entrega a vez.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Onde |
|---|---|---|
| completion signal | sinal de conclusão | Seção no adaptador |
| all done | missão completa | Todos os itens em Done, backlog vazio |
| blocked | aguardando humano | Item travado em estágio "doing", sem ACs pendentes |
| continuation | continuar | Itens pendentes, agente segue trabalhando |
| session summary | relato da sessão | Output final para o humano |

## Constraints

- A seção "Checklist de Encerramento" aparece no adaptador quando há workflow
- Três estados de conclusão: ALL_DONE, BLOCKED, CONTINUE
- O agente detecta o estado via `letra pulse --json` — não adivinha
- O relato de sessão é texto livre (agente escreve) — não estruturado
- A seção é gerada automaticamente junto com os adaptadores
- Não substitui o handoff — o handoff cobre "o que fazer depois de cada ação", o encerramento cobre "quando parar"

## Architecture

### Estados de Conclusão

```
CONTINUE                          BLOCKED                         ALL_DONE
┌─────────────┐                  ┌─────────────┐                 ┌─────────────┐
│ Backlog ≠ ∅ │                  │ Backlog = ∅  │                 │ Backlog = ∅  │
│ Itens doing │                  │ Itens doing  │                 │ Itens = ∅ ou │
│ ACs restam  │                  │ ACs = 0      │                 │ Todos Done   │
└──────┬──────┘                  │ Aguardando   │                 └──────┬──────┘
       │                         │ review/humano│                        │
       │                         └──────┬──────┘                        │
       ▼                                ▼                               ▼
  Continuar                        Reportar ao humano             Missão Completa
  trabalhando                      e aguardar                     — relato final
```

### Seção no Adaptador

```markdown
## Checklist de Encerramento

Antes de encerrar a sessão, identifique o estado do workspace:

1. `letra pulse --json` — veja itens, ACs, alertas, backlog

2. Decida o estado:

   **CONTINUE** (backlog tem itens OU item atual tem ACs pendentes):
     → Relate o progresso: quais ACs fez, o que falta, onde parou
     → Informe que vai continuar na próxima sessão
     → Se sessão ficou longa (>30 min de trabalho), pare e relate
     → Caso contrário, continue trabalhando

   **BLOCKED** (backlog vazio, item atual sem ACs pendentes, aguardando humano):
     → Relate: "Trabalho concluído, aguardando revisão/análise"
     → Liste o que foi feito e o que precisa de decisão humana
     → Encerre a sessão

   **ALL_DONE** (todos os itens em Done, backlog vazio):
     → Gere um relato de missão completa:
       - Quantos itens foram concluídos
       - O que foi construído/alterado
       - Próximos passos sugeridos (novos itens, melhorias)
     → Encerre a sessão
```

### Lógica de Detecção (no agente, baseada em `letra pulse --json`)

O agente não precisa de código novo no Letra para detectar o estado. Basta ler o JSON do pulse:

```typescript
// Lógica do agente (NÃO no Letra — no adapter/instrução)
function detectCompletionState(pulse: PulseData): "continue" | "blocked" | "all_done" {
  const backlogItems = pulse.nextItem !== null; // pulse mostra próximo do backlog
  const currentItem = pulse.currentItem !== null;
  const pendingACs = pulse.currentItem?.acs.pending ?? 0;
  const highAlerts = pulse.alerts.highSeverity > 0;

  if (!backlogItems && !currentItem) return "all_done";

  // Current item exists but no pending ACs and no backlog = waiting for human
  if (currentItem && pendingACs === 0 && !backlogItems) return "blocked";

  return "continue";
}
```

### Relato de Sessão

O agente escreve um relato no output final da sessão:

```
── Relato da Sessão ──────────────────────────────

Itens trabalhados:
  ITEM-41 (Prontuário de Saúde): 3/6 ACs concluídos
    ✅ health-record.json schema definido
    ✅ load/save implementados
    ✅ Merge com engine.runAll()
    ⬜ API REST (GET /api/health)
    ⬜ CLI letra health
    ⬜ Testes

Alertas encontrados: 0 novos, 1 resolvido
Decisões tomadas: usar JSON puro (sem zod) para schema validation

Estado final: CONTINUE — próximo item ITEM-42
```

## Acceptance Criteria

- [x] **Seção "Checklist de Encerramento"**: Aparece no adaptador quando workflow existe
- [x] **3 estados**: CONTINUE, BLOCKED, ALL_DONE com descrições claras
- [x] **Detecção por pulse**: O protocolo usa `letra pulse --json` para determinar estado
- [x] **BLOCKED**: Instrui agente a relatar e encerrar, não continuar
- [x] **ALL_DONE**: Instrui agente a gerar relato completo e encerrar
- [x] **CONTINUE**: Instrui agente a relatar progresso e decidir se continua ou para
- [x] **Limite de sessão**: Se >30 min de trabalho, instrui a pausar e relatar
- [x] **Relato de sessão**: Template de relato com itens, ACs, alertas, decisões
- [x] **Regeneração**: Seção atualizada quando adapters são gerados
- [x] **Testes**: Seção com cada estado (continue, blocked, all_done)

## Exclusions

- Timer automático de sessão — agente decide quanto tempo trabalha
- Relato estruturado em JSON — texto livre do agente é suficiente
- Notificação push para o humano — agente escreve no output da sessão
- Integração com Slack/Discord — apenas output no terminal

## Context

Este spec fecha o gap "quando parar". Sem ele, um agente diligente pode ficar em loop infinito processando um backlog vazio, ou encerrar sem avisar que está bloqueado esperando review humano.

O relato de sessão é a ponte entre o que o agente fez e o que o humano precisa saber. Não precisa ser estruturado — o agente sabe escrever em linguagem natural.
