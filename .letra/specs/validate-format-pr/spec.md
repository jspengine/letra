# Spec — Validate Format PR

## Outcome

`letra validate --format github-annotation` gera output compatível com GitHub Actions Annotations, permitindo que falhas de spec apareçam como comentários inline no diff do PR, não apenas no log do CI.

## Constraints

- Output deve seguir o formato `::error file=<path>,line=<n>,title=<title>::<message>` do GitHub Actions
- Fallback silencioso para formato texto se `--format` não for especificado (comportamento atual)
- Deve funcionar também com `--format junit` para integração com outros sistemas CI

## Exclusions

- **Não envia para GitHub API**: Apenas gera o formato correto no stdout; o GitHub Actions interpreta automaticamente
- **Sem formato HTML**: Apenas GitHub Annotations e JUnit XML

## Acceptance Criteria

- [ ] **--format github-annotation**: Gera saída no formato `::error file=...` legível por GitHub Actions.
- [ ] **--format text**: Mantém o formato atual de texto colorido (default).
- [ ] **Multiple Files**: Annotations apontam para o arquivo spec correto com linha do critério.
- [ ] **Summary**: Ao final, exibe resumo "X passed, Y failed, Z warnings" compatível com step summary.
- [ ] **JUnit XML**: `--format junit` gera XML compatível com ferramentas CI.

## Context

Hoje o `letra validate` no CI só mostra texto colorido no log. GitHub Actions suporta annotations que aparecem diretamente no diff do PR — muito mais visível e acionável. Isso transforma o validate de "ruído no log" em "bloqueio visível no código". O formato JUnit permite integração com GitLab CI, Jenkins, etc.
