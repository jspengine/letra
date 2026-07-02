## Acceptance Criteria

- [ ] **`flow backlog import`** aceita JSON via stdin (pipe)
- [ ] **`flow backlog import <file.json>`** aceita arquivo JSON
- [ ] Valida `title` obrigatório
- [ ] Valida `description` ≥ 30 caracteres
- [ ] Valida `title` ≠ `description`
- [ ] Emite warning para itens sem `acceptanceCriteria`
- [ ] Emite warning para itens sem `labels`
- [ ] Detecta duplicatas por similaridade de título
- [x] Se não há workflow, exibe "Run 'letra flow init --quick' first"
- [ ] Se JSON inválido, exibe erro amigável
