# Gerado por letra flow move. Nao edite manualmente.
# Letra Context — letra

Read the following files before starting any task:
- .letra/context.md
- .letra/constitution.md
- .letra/glossary.md
- .letra/focus.md (defines current session focus)

## Workflow

**Estagio atual:** Review

### Itens neste estagio

- ITEM-42: Alertas no Adaptador — visibilidade de pendências ativas nos arquivos de briefing do agente
  - spec: .letra/specs/adapter-alerts/spec.md
  - acceptance: .letra/specs/adapter-alerts/acceptance.md
- ITEM-43: Sala de Situação — comando letra sitrep para atualizar context.md com estado real
  - spec: .letra/specs/situation-room/spec.md
  - acceptance: .letra/specs/situation-room/acceptance.md
- ITEM-46: Checklist de Início — protocolo de abertura de sessão do agente no adaptador
  - spec: .letra/specs/session-kickoff/spec.md
  - acceptance: .letra/specs/session-kickoff/acceptance.md
- ITEM-47: Cardápio de Comandos — lista de comandos Letra categorizados no adaptador
  - spec: .letra/specs/command-menu/spec.md
  - acceptance: .letra/specs/command-menu/acceptance.md
- ITEM-52: Próximo Estágio — descoberta automática do destino com --auto
  - spec: .letra/specs/stage-discovery/spec.md
  - acceptance: .letra/specs/stage-discovery/acceptance.md
**Item atual**: ITEM-47 (command-menu)
  Estágio: Review
  ➡ Próximo estágio: Done
  Comando: `letra flow move ITEM-47 --auto`

## Sinais de trabalho

**Item primario:** ITEM-47 (command-menu)
**ACs:** 9/9 pendentes
**Tasks:** 0/0 abertas

## Checklist de Início

1. **Verificar pulso**: `letra pulse` — veja o estado atual do workspace
2. **Verificar alertas**: Leia "Pendências Detectadas" acima (se houver)
3. **Ler contexto**: Abra `.letra/context.md` para contexto completo
4. **Identificar item**: O pulse mostra qual item está ativo e seus ACs
5. **Mão na massa**: Trabalhe no item ativo seguindo os ACs da spec

## Comandos Disponíveis

Leitura (seguro — não muda nada):
  `letra pulse`                    — Overview do workspace
  `letra health`                   — Alertas ativos
  `letra health --all`             — Alertas incluindo resolvidos
  `letra sitrep --dry-run`         — Simular atualização de contexto
  `letra flow board`               — Todas as colunas do fluxo
  `letra flow backlog`             — Itens no backlog

Escrita (muda estado):
  `letra health ack <id>`          — Reconhecer alerta
  `letra health dismiss <id>`      — Descartar alerta
  `letra health scan`              — Re-executar verificações
  `letra sitrep`                   — Atualizar context.md
  `letra flow move <id> --to <s>`  — Mover item entre estágios
  `letra focus <spec>`             — Definir foco

Setup:
  `letra validate`                 — Validar specs e ACs
  `letra focus --clear`            — Limpar foco

## Pendências Detectadas

Alerta · severidade baixa
  ID: hr-5be274ce
  O que: Detector stage-drift com certainty 0.85 < 0.9 mas tem autoFix
  Onde: harness-meta-test
  Desde: 15/06/2026
  Ação: `letra health ack hr-5be274ce`

Alerta · severidade média
  ID: hr-303c8d58
  O que: AC "letra spec new <nome>" marcado [x] mas não encontrado no código
  Onde: ac-false-pos
  Desde: 15/06/2026
  Ação: `letra health ack hr-303c8d58`

Alerta · severidade média
  ID: hr-34db55c8
  O que: AC "flow diff v1.0.0 v1.1.0" marcado [x] mas não encontrado no código
  Onde: ac-false-pos
  Desde: 15/06/2026
  Ação: `letra health ack hr-34db55c8`

Alerta · severidade média
  ID: hr-105281c3
  O que: AC "flow move <id> --to <stage>" marcado [x] mas não encontrado no código
  Onde: ac-false-pos
  Desde: 15/06/2026
  Ação: `letra health ack hr-105281c3`

Alerta · severidade média
  ID: hr-44d3ca03
  O que: AC "flow backlog list" marcado [x] mas não encontrado no código
  Onde: ac-false-pos
  Desde: 15/06/2026
  Ação: `letra health ack hr-44d3ca03`

  e mais 12 alertas

## Regras

- Leia as specs em .letra/specs/ antes de codificar
- Execute `letra validate` para verificar acceptance criteria
- Siga a constitution.md rigorosamente
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`
