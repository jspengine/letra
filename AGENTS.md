# Gerado por letra flow move. Nao edite manualmente.

### ⚠ ATENÇÃO: 2 problema(s) grave(s) detectado(s) pelo diagnóstico automático
Execute `letra health` para detalhes e `letra health ack <id>` para reconhecer.
# Letra Session — Letra

PASSO OBRIGATÓRIO #1: letra pulse — verificar estado do workspace
PASSO OBRIGATÓRIO #2: Leia .letra/context.md — contexto completo do projeto
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md — foco e outcome da sessão
PASSO OBRIGATÓRIO #4: Leia .letra/specs/workspace-settings/spec.md — ACs do item

## Foco Atual

Item: ITEM-77 · Painel de Configuracoes do Workspace — CRUD completo de targets, rename, template switch, adapters, delete com rollback
Spec: workspace-settings
Estágio: Backlog → Design

## Direção do Harness

<!-- harness-direction:start -->
**Versão**: v0.1.3 | **Estágios**: backlog
**Item**: ITEM-77 — Painel de Configuracoes do Workspace — CRUD completo de targets, rename, template switch, adapters, delete com rollback (Backlog)
_Estágio sem activity configurada no harness._
<!-- harness-direction:end -->

## Alertas

Alerta · severidade baixa
  ID: hr-4652f8f0
  O que: AC "flow diff" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 31/07/2026, 14:50:21
  Ação: `letra health ack hr-4652f8f0`

Alerta · severidade baixa
  ID: hr-4103b765
  O que: AC "flow visualize" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 31/07/2026, 14:50:21
  Ação: `letra health ack hr-4103b765`

Alerta · severidade baixa
  ID: hr-dd77601
  O que: AC "flow export" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 31/07/2026, 14:50:21
  Ação: `letra health ack hr-dd77601`

Alerta · severidade baixa
  ID: hr-6380dc9e
  O que: AC "GET /" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 31/07/2026, 14:50:21
  Ação: `letra health ack hr-6380dc9e`

Alerta · severidade baixa
  ID: hr-352219f2
  O que: AC "letra sitrep" marcado [ ] mas implementado
  Onde: ac-stale
  Desde: 31/07/2026, 14:50:21
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

## Após completar uma ação

- `letra validate` — validate
  ❌ Se falhar: letra diagnose — encontrar e corrigir problemas
- `letra pulse` — pulse
  ❌ Se falhar: letra health — checar alertas ativos
- `letra sitrep` — sitrep
  ❌ Se falhar: corrija o erro e tente novamente
- `letra flow move ITEM-77 --to design` — flow move
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

- [Context](file:///C:/Workspace/letra/.letra/context.md)
- [Constitution](file:///C:/Workspace/letra/.letra/constitution.md)
- [Glossary](file:///C:/Workspace/letra/.letra/glossary.md)
- [Constraints](file:///C:/Workspace/letra/.letra/constraints.md)
- [Focus](file:///C:/Workspace/letra/.letra/focus.md)
- [Spec: workspace-settings](file:///C:/Workspace/letra/.letra/specs/workspace-settings/spec.md)
- [ITEM-77](file:///C:/Workspace/letra/.letra/workflow.json)
