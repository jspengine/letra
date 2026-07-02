# Spec: handoff-rules

> Updated: 2026-06-22

## Outcome

Quando um agente completa uma tarefa (edita código, atualiza spec, move item), ele sabe exatamente o que fazer em seguida — inclusive o que fazer quando algo dá errado. O adaptador contém uma seção "Após completar uma ação" com passos claros e rotas de recuperação para cada falha possível.

O ciclo fecha sem o humano precisar lembrar o agente do que fazer. O agente tem um protocolo explícito que cobre o caminho feliz E os desvios.

## Constraints

- Seção aparece apenas quando há um item ativo no workflow (estágio "doing")
- Passos padrão são sempre os mesmos, mas podem ser estendidos por config
- A seção é concisa — máximo 10 linhas no adaptador
- Comandos são executáveis via copy-paste (inline code blocks)
- Não é automação — o Letra não executa comandos, apenas instrui o agente
- O humano pode desabilitar a seção via config (`"handoff": false`)

## Exclusions

- Execução automática dos passos — apenas instrução textual
- Handoff diferente por tipo de tarefa — mesmo protocolo para tudo
- Validação de que o agente seguiu os passos — confiança no agente
- Recovery automático — agente decide quando e como recuperar

## Acceptance Criteria

- [x] **Seção "Após completar uma ação"**: Aparece no adaptador quando há item ativo
- [x] **Passos padrão com recovery**: validate (↔ diagnose), pulse (↔ health), sitrep, flow move, build
- [x] **Recovery paths**: Cada passo documenta ❌ o que fazer em caso de falha
- [x] **Item específico**: Comando `flow move` usa o ID do item ativo
- [x] **Sem item ativo**: Seção não aparece (sem ruído)
- [x] **Config desabilitar**: `"handoff": false` ou `"handoff.enabled": false` remove seção
- [x] **Steps customizados**: `handoff.customSteps` adiciona passos extras
- [x] **Skip steps**: `handoff.skipSteps` remove passos padrão
- [x] **Formato conciso**: Máximo 20 linhas no adaptador (incluindo recovery paths)
- [x] **Flow move com placeholder**: Usa `--to proximo_estagio` — humano/agente substitui
- [x] **Regeneração**: Seção atualizada quando item muda de estágio
- [x] **Testes**: Seção aparece com item ativo, recovery paths corretos por passo, sem item não aparece, custom/skip steps, disabled via config

## Context

Este spec fecha o ciclo agêntico. Os outros specs (health-record, adapter-alerts, situation-room, workspace-pulse) fornecem a infraestrutura de estado e visibilidade. O handoff-rules fornece o **protocolo** — o que fazer com essa infraestrutura.

Sem este spec, o agente tem as ferramentas (health, pulse, sitrep) mas não sabe quando usá-las. Com ele, o adaptador instrui explicitamente: "depois de trabalhar, faça X, Y, Z".
