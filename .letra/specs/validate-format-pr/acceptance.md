# Acceptance Criteria — validate-format-pr

- [ ] **--format github-annotation**: Gera saída no formato `::error file=...` legível por GitHub Actions.
- [ ] **--format text**: Mantém o formato atual de texto colorido (default).
- [ ] **Multiple Files**: Annotations apontam para o arquivo spec correto com linha do critério.
- [ ] **Summary**: Ao final, exibe resumo "X passed, Y failed, Z warnings" compatível com step summary.
- [ ] **JUnit XML**: `--format junit` gera XML compatível com ferramentas CI.
