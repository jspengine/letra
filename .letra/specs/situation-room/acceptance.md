## Acceptance Criteria

- [ ] **`letra sitrep`**: Comando principal atualiza context.md com estado real
- [ ] **Seções manuais preservadas**: Intent, Domínio, Stack, Restrições, Porquês intactos
- [ ] **Data atualizada**: Campo `> Updated:` sempre atualizado
- [ ] **Bloco dinâmico**: Conteúdo entre `<!-- sitrep:start -->` e `<!-- sitrep:end -->` substituído
- [ ] **Inserção inicial**: Se bloco não existe, inserido antes de `## Stack`
- [ ] **Dry-run**: `letra sitrep --dry-run` exibe diff sem escrever
- [ ] **Fallback sem vitest**: Se vitest falha, mostra "N/A (vitest unavailable)" em vez de quebrar
- [ ] **Fallback sem build**: Se build falha, mostra "Falha — verifique o build" em vez de quebrar
- [ ] **Workflow ausente**: Sem workflow.json, mostra "N/A (sem workflow)" sem quebrar
- [ ] **Sem prontuário**: Sem health-record.json, mostra "0 alertas" sem quebrar
- [ ] **Ignore**: Comentário `<!-- sitrep:ignore -->` impede substituição de seção
- [ ] **Testes**: Sync preserva seções manuais, atualiza data, fallback sem vitest, fallback sem build
- [ ] **Output claro**: Comando imprime quais seções foram alteradas
