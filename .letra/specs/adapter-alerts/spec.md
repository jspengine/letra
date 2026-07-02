# Spec: adapter-alerts

> Updated: 2026-06-22

## Outcome

Quando um agente (OpenCode, Cursor, Claude Code, etc.) inicia uma sessão no workspace, ele lê o arquivo adaptador (AGENTS.md, .cursorrules, CLAUDE.md) e vê imediatamente os alertas ativos do prontuário de saúde. Não precisa rodar `letra health` — a informação já está lá, no formato que o agente entende.

O desenvolvedor não precisa lembrar de verificar alertas manualmente. O agente já chega sabendo o que está desalinhado, o que precisa de atenção, e onde os problemas estão.

## Constraints

- Seção de alertas aparece apenas quando há entradas ativas no prontuário
- Máximo 5 alertas "novo" no adaptador para não poluir o arquivo
- Se houver mais que 5, exibe "... e mais N alertas"
- Alertas "ciente" não aparecem na seção principal, apenas se `--all`
- Formato legível por humanos **e** parseável por agentes (consistente)
- Geração automática: toda vez que adapters são regenerados (após flow move, init, focus)
- O formato deve ser o mesmo em todas as ferramentas (cursor, opencode, vscode, windsurf, claude-code)

## Exclusions

- UI gráfica para alertas — apenas seção textual no adaptador
- Alertas formatados diferente por ferramenta — todas usam o mesmo formato
- Histórico completo no adaptador — apenas ativos

## Acceptance Criteria

- [ ] **Seção condicional**: Adaptador só tem `## Pendências Detectadas` se health-record tem entradas "novo"
- [ ] **Limite 5**: Máximo 5 alertas na seção; excedente vira "... e mais N alertas"
- [ ] **Formato consistente**: Mesmo formato em AGENTS.md, .cursorrules, CLAUDE.md, .windsurfrules
- [ ] **Ação sugerida**: Cada alerta inclui linha `Ação:` com comando `letra health ack/dismiss`
- [ ] **Severidade**: Alertas exibem badge de severidade (baixa/media/alta)
- [ ] **Regeneração**: `letra health scan` → adapters regenerados automaticamente
- [ ] **Zero alertas**: Sem entradas "novo" → seção não aparece (sem ruído)
- [ ] **--all**: `letra generate --all` inclui alertas "ciente" também
- [ ] **Parseável**: Agente extrai IDs e comandos por regex consistente
- [ ] **Testes**: Alerta aparece com 1 entrada "novo", não aparece com 0 entradas, limite 5 com "e mais N"

## Context

Este spec substitui o rascunho anterior `diagnostics-adapter`. A mudança de nome reflete que não são "diagnósticos" técnicos — são "alertas" que um humano ou agente precisa ver para agir. A seção no adaptador é a ponte entre o prontuário (health-record) e o agente que vai atuar no workspace.

Sem este spec, o agente nunca sabe que existem alertas. O health-record existe mas fica invisível.
