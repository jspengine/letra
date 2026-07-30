# Acceptance Criteria — release-readiness

- [ ] **AC1 — Catálogo revisável sobe green**: `npm run storybook:build` conclui sem erro e expõe 39 stories + Foundations para revisão humana
- [ ] **AC2 — Theme-switch habilita revisão dark/light do rebrand**: toolbar alterna .dark/.light e tokens de marca trocam de fato
- [ ] **AC3 — Diff visual do rebrand documentado**: story/página mostra estado atual vs. proposta (cores de marca, logo, superfícies)
- [ ] **AC4 — Sign-off humano registrado**: aprovação do rebrand consta no health/gate antes do merge (ITEM-36)
- [ ] **AC5 — DS sem drift na data da release**: ds:check + ds:validate + typecheck + test green no workspace
