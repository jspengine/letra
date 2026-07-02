## Acceptance Criteria

- [x] **--format github-annotation**: Gera saída no formato `::error file=...` legível por GitHub Actions.
- [x] **--format text**: Mantém o formato atual de texto colorido (default).
- [x] **Multiple Files**: Annotations apontam para o arquivo spec correto com linha do critério.
- [x] **Summary**: Ao final, exibe resumo "X passed, Y failed, Z warnings" compatível com step summary.
- [x] **JUnit XML**: `--format junit` gera XML compatível com ferramentas CI.
