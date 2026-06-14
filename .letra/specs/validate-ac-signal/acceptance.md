# Acceptance Criteria — validate-ac-signal

- [ ] **Resumo sempre presente**: Toda spec com ACs exibe linha `ACs: X/Y pending` ou `ACs: Y/Y done` — nunca "No criteria found".
- [ ] **Lista done**: ACs marcados `[x]` aparecem com indicador ✓ no output terminal.
- [ ] **Lista pending**: ACs marcados `[ ]` aparecem com indicador ✗ e contam para exit code 1.
- [ ] **Fonte primária**: Quando `acceptance.md` existe, ACs vêm dele; output indica `(source: acceptance.md)`.
- [ ] **Fallback spec.md**: Sem `acceptance.md`, ACs vêm da seção `## Acceptance Criteria` em `spec.md`.
- [ ] **Sem ACs definidos**: Spec sem ACs em nenhum arquivo exibe `No acceptance criteria defined` com severity warning.
- [ ] **ac-source-drift warning**: Quando ambos existem e contagem de `[x]` difere, exibe warning com contagens de cada fonte.
- [ ] **Config heurística**: `ac-source-drift` configurável em `.letra/config.json` com severity off/warning/error.
- [ ] **github-annotation**: Formato inclui annotation para ACs pendentes e warning para drift.
- [ ] **junit**: Cada AC é testcase; pendentes são failures; done são passed.
- [ ] **ac-parser compartilhado**: `packages/cli/src/lib/ac-parser.ts` usado por validate e adapters builder.
- [ ] **Testes**: Casos cobrem all-done, all-pending, mixed, no-ac, drift, fallback spec.md.
