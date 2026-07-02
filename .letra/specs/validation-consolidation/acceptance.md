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
