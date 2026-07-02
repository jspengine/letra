## Acceptance Criteria

- [ ] **AC1**: Auditoria de inconsistência de tokens — mapear todas as `var(--*)` usadas no cliente vs. tokens oficiais em `design-tokens.css`, gerando relatório de gaps em `design-system/audit.md`.
- [ ] **AC2**: Unificação do namespace de tokens — proposta e documentação da ponte entre `--brand-*` (primitivos) e `--*` semântico (`--surface`, `--foreground`, `--border` etc.) em `design-system/tokens/semantic-map.md`.
- [ ] **AC3**: Token scale completa — spacing (base 4px), z-index, focus rings, motion detalhado e breakpoints documentados em `design-system/tokens/scale.md`.
- [ ] **AC4**: Mapeamento de telas — cada uma das 14 views do cliente documentada com layout, propósito, elementos principais e status de conformidade com LDL em `design-system/screens/` (1 arquivo por tela).
- [ ] **AC5**: Spec de estados de componentes — Loading, Empty, Success, Error, Disabled com critérios visuais e de acessibilidade em `design-system/states.md`.
- [ ] **AC6**: Spec de jornadas UX — Onboarding, Item em andamento, Gate pendente, Erro crítico — fluxo de telas e transições documentados em `design-system/journeys.md`.
