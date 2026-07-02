## Acceptance Criteria

- [ ] **Preservação**: Seções Intent, Domínio, Stack, Restrições, Porquês não são modificadas
- [ ] **Updated**: Campo `> Updated:` atualizado para a data do sync
- [ ] **Estágio**: Lido de `.letra/workflow.json` — estágio que contém itens
- [ ] **Testes**: `vitest run --reporter=json` parseado para contagem passing/total
- [ ] **Build**: `npm run build --silent` verifica se build compila (exit code)
- [ ] **Fallback**: Se vitest falha, "Testes" mostra "N/A (vitest unavailable)"
- [ ] **Fallback**: Se build falha, "Build" mostra "Falha — verifique o build"
- [ ] **CLI**: `letra context sync [path]` é o comando; `letra context sync --dry-run` mostra diff sem escrever
- [ ] **Meta-test**: Detector alerta se context.md `Updated:` > 7 dias e não houve sync recente
- [ ] **Testes**: Sync preserva seções manuais, atualiza data, fallback sem vitest
