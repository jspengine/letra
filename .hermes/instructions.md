# Letra Session — Letra

PASSO OBRIGATÓRIO #1: letra pulse — verificar estado do workspace
PASSO OBRIGATÓRIO #2: Leia .letra/context.md — contexto completo do projeto
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md — foco e outcome da sessão
PASSO OBRIGATÓRIO #4: Leia .letra/specs/declarative-service-operations/spec.md — ACs do item

## Foco Atual

Item: ITEM-96 · ITEM-96: Eliminate hardcoded stage/role/gate references in service.ts and gate-checker.ts — make service layer fully YAML-driven
Spec: declarative-service-operations
Estágio: Code → Review
ACs: 15/15 pendentes

## Direção do Harness

<!-- harness-direction:start -->
**Versão**: v0.2.0 | **Papel**: implementer | **Estágios**: code
**Item**: ITEM-96 — ITEM-96: Eliminate hardcoded stage/role/gate references in service.ts and gate-checker.ts — make service layer fully YAML-driven (Code)
**Objetivo**: Implement acceptance criteria one by one.
**Comandos**:
- `letra ac done AC1` — Complete AC
- `letra ac done AC2` — Complete AC
- `letra ac done AC3` — Complete AC
- `letra ac done AC4` — Complete AC
- `letra ac done AC5` — Complete AC
- `letra ac done AC6` — Complete AC
- `letra ac done AC7` — Complete AC
- `letra ac done AC8` — Complete AC
- `letra ac done AC9` — Complete AC
- `letra ac done AC10` — Complete AC
- `letra ac done AC11` — Complete AC
- `letra ac done AC12` — Complete AC
- `letra ac done AC13` — Complete AC
- `letra ac done AC14` — Complete AC
- `letra ac done AC15` — Complete AC
- `letra flow handoff --to reviewer --summary 'Implementation complete.'` — Handoff to Reviewer
**Proibições**: Do not skip tests Do not approve your own work
**Próximas ações**:
1. Implement — Implement ACs with regression tests.
<!-- harness-direction:end -->

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

## Após completar uma ação

- `letra validate` — validate
  ❌ Se falhar: letra diagnose — encontrar e corrigir problemas
- `letra pulse` — pulse
  ❌ Se falhar: letra health — checar alertas ativos
- `letra sitrep` — sitrep
  ❌ Se falhar: corrija o erro e tente novamente
- `letra flow move ITEM-96 --to review` — flow move
  ❌ Se falhar: letra validate — verificar ACs pendentes
- `npm run build` — build
  ❌ Se falhar: corrija erros de compilação

Após mover, verifique o novo estágio com `letra pulse`

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

Última atividade: 27/07/2026, 04:42:18
Ações:
  • system: automation:diagnostics-scan | triggered | cause=Ti
  • system: automation:diagnostics-scan | failed | cause=Timer
  • system: automation:diagnostics-scan | triggered | cause=Ti
  • system: automation:diagnostics-scan | completed | cause=Ti
  • system: automation:specs-watch | triggered | cause=Mudança

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

## Referências

- [Context](file:///C:/Users/rnasc/.letra/workspaces/letra/context.md)
- [Constitution](file:///C:/Users/rnasc/.letra/workspaces/letra/constitution.md)
- [Glossary](file:///C:/Users/rnasc/.letra/workspaces/letra/glossary.md)
- [Constraints](file:///C:/Users/rnasc/.letra/workspaces/letra/constraints.md)
- [Focus](file:///C:/Users/rnasc/.letra/workspaces/letra/focus.md)
- [Spec: declarative-service-operations](file:///C:/Users/rnasc/.letra/workspaces/letra/specs/declarative-service-operations/spec.md)
- [ITEM-96](file:///C:/Users/rnasc/.letra/workspaces/letra/workflow.json)
