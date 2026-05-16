# Acceptance Criteria — validate-watch

- [x] **Flag --watch**: `letra validate --watch` inicia em modo monitoramento.
- [x] **Re-executa em mudança**: Alterar qualquer `spec.md` re-executa validate automaticamente.
- [x] **Debounce**: Múltiplas alterações em rápida sucessão agrupam em uma única validação (300ms).
- [x] **Clean exit**: Ctrl+C encerra o watch sem erros.
- [x] **Ignora .gitignore**: Arquivos em pastas ignoradas não disparam validação.
