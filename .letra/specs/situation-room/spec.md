# Spec: situation-room

> Updated: 2026-06-22

## Outcome

O `context.md` do Letra para de ser um documento estático que desatualiza com o tempo. Com um comando `letra sitrep`, o contexto é atualizado automaticamente com o estado real do workspace: workflow atual, item em andamento, alertas do prontuário, decisões recentes, contagem de ACs.

O desenvolvedor (ou agente) não precisa editar context.md manualmente. O comando puxa informações de várias fontes e monta um relato de situação coeso. Seções escritas manualmente (Intent, Stack, Porquês) são preservadas — só o que é dinâmico é substituído.

## Constraints

- Apenas seções marcadas como dinâmicas são substituídas
- Seções manuais (Intent, Domínio, Stack, Restrições, Porquês) nunca são tocadas
- Comentário `<!-- sitrep:ignore -->` em qualquer seção impede substituição
- Campo `> Updated:` é sempre atualizado para a data/hora do comando
- `--dry-run` exibe diff sem modificar arquivo
- Falha silenciosa se `.letra/` não existe (exit 0 com warning)
- Output do comando mostra o que mudou (seções adicionadas/removidas/atualizadas)

## Exclusions

- Edição de seções manuais via CLI — apenas substituição do bloco dinâmico
- Múltiplos blocos dinâmicos — apenas um bloco `sitrep` por context.md
- Geração automática (cron/timer) — apenas sob comando explícito

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

## Context

Este spec substitui o rascunho anterior `context-sync`. O nome "sala de situação" comunica melhor a ideia de um relato de situação atualizado sob demanda, em vez de "sincronizar contexto" (que parece uma operação técnica).

O `letra sitrep` é o comando que o agente (ou humano) roda antes de começar a trabalhar, ou depois de fazer mudanças, para garantir que o context.md reflete a realidade.
