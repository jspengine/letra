# Acceptance Criteria — Validate Config & Opt-out

- [x] **Arquivo de Config**: `letra init` cria `.letra/config.json` com todas as heurísticas listadas e `severity: "warning"`.
- [x] **Severity Error**: Heurística com `severity: "error"` quebra o CI (exit 1).
- [x] **Severity Warning**: Heurística com `severity: "warning"` exibe alerta mas não quebra (exit 0).
- [x] **Severity Off**: Heurística com `severity: "off"` não executa nem alerta.
- [x] **Custom Blacklist**: Usuário pode sobrescrever a lista de coloquialismos no config.
- [x] **Custom Threshold**: Usuário pode alterar limite de caracteres do Conteúdo Mínimo e dias do Drift Temporal.
- [x] **Backward Compatible**: Sem config, todas as heurísticas rodam como warning.
