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
