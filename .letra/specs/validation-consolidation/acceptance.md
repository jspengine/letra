# Validation Consolidation — Acceptance Criteria

## Marcados como concluídos

- [x] **validation/structure.ts**: Exporta `checkRequiredSections`, `checkSpecLength`, `checkChecklist`, `validateSpecStructure`
- [x] **lint.ts thin wrapper**: Usa `validation/structure.ts` — mesmo output, 46 linhas (antes 90)
- [x] **flow-serve.ts**: Importa `validateSpecStructure` de `validation/structure.js` ao invés de inline
- [x] **validation/content.ts**: Exporta `checkSpecContent`, `checkConflicts`, `checkBinaryCriteria`, `checkEmptySections`, `checkLowConfidence`
- [x] **diagnostics/shared/file-search.ts**: Exporta `searchInSource`, `walkDir`
- [x] **ac-stale.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [x] **ac-false-pos.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [x] **spec-code-drift.ts**: Importa `searchInSource` de `../shared/file-search.js` — função inline removida
- [x] **diagnostics/shared/spec-reader.ts**: Exporta `loadSpecDirs`, `parseACs`, `countACs`
- [x] **Todos os testes existentes passam** (168/168, 25 test files)
- [x] **Nenhuma mudança de output** em lint/validate CLI

## Parcial

- [~] **validate.ts thin wrapper**: Usa `validation/content.ts` — mesmo output, 542 linhas (antes 956). Heap de validação está em `validation/content.ts`, mas CLI orchestration (runValidation, output formatting, watch mode) permanece em validate.ts. Redução de 43%.
