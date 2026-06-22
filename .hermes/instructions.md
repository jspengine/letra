# Letra Session — Letra Self-Management

PASSO OBRIGATÓRIO #1: letra pulse — verificar estado do workspace
PASSO OBRIGATÓRIO #2: Leia .letra/context.md — contexto completo do projeto
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md — foco e outcome da sessão
PASSO OBRIGATÓRIO #4: Leia .letra/specs/harness-loader-implementation/spec.md — ACs do item

## Foco Atual

Item: item-1 · workspace-discovery
Spec: harness-loader-implementation
Estágio: Spec Review → Code

## Alertas

Alerta · severidade baixa
  ID: hr-4652f8f0
  O que: AC "flow diff" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 22/06/2026, 11:10:40
  Ação: `letra health ack hr-4652f8f0`

Alerta · severidade baixa
  ID: hr-4103b765
  O que: AC "flow visualize" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 22/06/2026, 11:10:40
  Ação: `letra health ack hr-4103b765`

Alerta · severidade baixa
  ID: hr-dd77601
  O que: AC "flow export" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 22/06/2026, 11:10:40
  Ação: `letra health ack hr-dd77601`

Alerta · severidade baixa
  ID: hr-6380dc9e
  O que: AC "GET /" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 22/06/2026, 11:10:40
  Ação: `letra health ack hr-6380dc9e`

Alerta · severidade baixa
  ID: hr-352219f2
  O que: AC "letra sitrep" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 22/06/2026, 11:10:40
  Ação: `letra health ack hr-352219f2`

  e mais 3 alertas

## Regras (Violação = Erro Grave)

**Violação = Erro Grave**

- Não edite workflow.json manualmente — use `letra flow` e `letra focus`
- Não crie specs fora de .letra/specs/ — use `letra spec new`
- Não pule os passos obrigatórios de início acima
- Execute `letra validate` antes de mover item entre estágios
- Siga a constitution.md rigorosamente

## Fluxo de Execução

**Loop por AC**:
  1. Implemente o AC no código
  2. `letra ac done <AC-ID>` — marca como concluído no spec.md
  3. `letra validate` — verifica se ACs estão consistentes
  4. Repita até todos os ACs do item estarem concluídos

**Ao concluir todos ACs**:
  → `letra pulse` — confirma estado
  → `letra sitrep` — atualiza context.md
  → `letra flow move <ITEM-ID> --auto` — avança para próximo estágio

## Comandos

**Leitura (seguro — não muda nada):**
  `letra pulse`                    — Overview do workspace
  `letra health`                   — Alertas ativos
  `letra flow board`               — Todas as colunas do fluxo
  `letra flow backlog`             — Itens no backlog
  `letra validate`                 — Validar specs e ACs

**Escrita (muda estado):**
  `letra health ack <id>`          — Reconhecer alerta
  `letra health dismiss <id>`      — Descartar alerta
  `letra health scan`              — Re-executar verificações
  `letra sitrep`                   — Atualizar context.md
  `letra flow move <id> --to <s>`  — Mover item entre estágios
  `letra focus <spec>`             — Definir foco
  `letra focus --clear`            — Limpar foco

## Continuidade

Última atividade: 15/06/2026, 17:55:27
Ações:
  • item_move: Item ITEM-49 movido: Backlog → Done
  • item_move: Item ITEM-44 movido: Backlog → Code
  • item_move: Item ITEM-44 movido: Code → Review
  • item_move: Item ITEM-44 movido: Review → Done
  • validate: Validação executada — 26 passed, 0 failed, 248 war

## Checklist de Encerramento

1. `letra pulse --json` — veja itens, ACs, alertas, backlog

2. Decida o estado:

   **CONTINUE** (backlog tem itens OU item atual tem ACs pendentes):
     → Relate o progresso: quais ACs fez, o que falta, onde parou
     → Se sessão >30 min, pare e relate. Caso contrário, continue.

   **BLOCKED** (backlog vazio, item sem ACs pendentes, aguardando humano):
     → Relate "Trabalho concluído, aguardando revisão"
     → Liste o que foi feito e decisões necessárias

   **ALL_DONE** (todos os itens em Done, backlog vazio):
     → Relate missão completa: itens concluídos, o que foi construído, próximos passos

## Arquivos de Contexto

- .letra/context.md
- .letra/constitution.md
- .letra/glossary.md
- .letra/constraints.md
- .letra/focus.md
