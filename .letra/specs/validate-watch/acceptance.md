# Acceptance Criteria — validate-watch

- [ ] **Flag --watch**: `letra validate --watch` inicia em modo monitoramento.
- [ ] **Re-executa em mudança**: Alterar qualquer `spec.md` re-executa validate automaticamente.
- [ ] **Debounce**: Múltiplas alterações em rápida sucessão agrupam em uma única validação (300ms).
- [ ] **Clean exit**: Ctrl+C encerra o watch sem erros.
- [ ] **Ignora .gitignore**: Arquivos em pastas ignoradas não disparam validação.
