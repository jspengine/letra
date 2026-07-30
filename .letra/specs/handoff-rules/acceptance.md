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
