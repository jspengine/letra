# Spec: validation-consolidation

> Updated: 2026-06-22

## Outcome

Três sistemas paralelos de validação (`lint.ts`, `validate.ts`, e os detectores de diagnóstico) compartilham módulos comuns. Código duplicado (~160 linhas) é extraído para módulos shared. Nenhum comportamento muda — apenas a estrutura.

## Constraints

- Zero mudança de comportamento nos comandos CLI existentes
- Zero mudança no output de `lint`, `validate`, `diagnose`
- Todos os testes existentes continuam passando sem modificação
- Módulos shared são funções puras (sem estado, sem efeito colateral)
- Import paths seguem o padrão ESM existente (`import { x } from "../shared/file-search.js"`)

## Exclusions

- Refatoração de `flow-serve.ts:handleRequest` (routing) — escopo separado
- Unificação de `checkConflicts` e `crossSpecDepDetector` — abordagens diferentes (heuristic vs item-ref)
- Mudança na ordem de execução dos detectores
- Novos detectores

## Acceptance Criteria

- [ ] **validation/structure.ts**: Exporta `checkRequiredSections`, `checkSpecLength`, `checkChecklist`, `validateSpecStructure`
- [ ] **lint.ts thin wrapper**: Usa `validation/structure.ts` — mesmo output, ~20 linhas (antes 90)
- [ ] **flow-serve.ts**: Importa `checkRequiredSections` de `validation/structure.ts` ao invés de inline
- [ ] **validation/content.ts**: Exporta `checkSpecContent`, `checkConflicts`, `checkBinaryCriteria`
- [ ] **validate.ts thin wrapper**: Usa `validation/content.ts` — mesmo output, ~50 linhas (antes 956)
- [ ] **diagnostics/shared/file-search.ts**: Exporta `searchInSource`, `walkDir`
- [ ] **ac-stale.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [ ] **ac-false-pos.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [ ] **spec-code-drift.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [ ] **diagnostics/shared/spec-reader.ts**: Exporta `loadSpecs`, `parseACs`, `countACs`
- [ ] **Todos os testes existentes passam** sem modificação
- [ ] **Nenhuma mudança de output** em lint/validate CLI

## Context

Este spec é puramente refatoração mecânica — extrair funções duplicadas para módulos compartilhados. O ganho é manutenibilidade: corrigir um bug em `searchInSource` agora significa editar um arquivo, não três. O risco é mínimo porque as funções são puras e cada extração mantém a interface idêntica.

A separação entre `validation/` e `diagnostics/shared/` é intencional:
- `validation/` cuida de formato e conteúdo de specs (usado por lint, validate, CI)
- `diagnostics/shared/` cuida de busca em código fonte (usado por detectores)
- São domínios diferentes que não devem ser acoplados
