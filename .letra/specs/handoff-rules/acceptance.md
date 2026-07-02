## Acceptance Criteria

- [ ] **Seção "Após completar uma ação"**: Aparece no adaptador quando há item ativo
- [ ] **Passos padrão com recovery**: validate (↔ diagnose), pulse (↔ health), sitrep, flow move, build
- [ ] **Recovery paths**: Cada passo documenta ❌ o que fazer em caso de falha
- [ ] **Item específico**: Comando `flow move` usa o ID do item ativo
- [ ] **Sem item ativo**: Seção não aparece (sem ruído)
- [ ] **Config desabilitar**: `"handoff": false` ou `"handoff.enabled": false` remove seção
- [ ] **Steps customizados**: `handoff.customSteps` adiciona passos extras
- [ ] **Skip steps**: `handoff.skipSteps` remove passos padrão
- [ ] **Formato conciso**: Máximo 20 linhas no adaptador (incluindo recovery paths)
- [ ] **Flow move com placeholder**: Usa `--to proximo_estagio` — humano/agente substitui
- [ ] **Regeneração**: Seção atualizada quando item muda de estágio
- [ ] **Testes**: Seção aparece com item ativo, recovery paths corretos por passo, sem item não aparece, custom/skip steps, disabled via config
