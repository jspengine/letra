# Spec: Release Readiness — Product Rebrand

> Updated: 2026-07-11

## Outcome
O humano responsável consegue revisar, comparar e aprovar a mudança de identidade visual (product-rebrand / amber-rebrand) **antes** do ship, usando o catálogo do Design System como fonte única da verdade visual. A aprovação é um gate explícito: nada do rebrand é mesclado sem sign-off registrado no harness.

## Constraints
- `Human in the Loop` é autoridade máxima aqui: o rebrand (tema amber, tokens de marca, identidade) não avança sem aprovação humana explícita (ITEM-80).
- `@letra/ui` e os tokens canônicos de `packages/ui/src/index.css` são a única fonte de verdade de cor/espaçamento/raio/motion. O rebrand os consume, não os redefine.
- O catálogo (Storybook) deve estar funcional e acessível para revisão — é a superfície de aprovação.
- `storybook-design-token` está **indisponível** para a stack atual (SB 8.6 + React 19): v3 exige React ≤18, v4 exige SB ≥9. Tokens visuais são cobertos por CSF stories em `packages/ui/src/foundations/`.
- Nenhum destino duplicado, controle inerte ou linguagem que prometa automação inexistente pode existir nas telas do rebrand.

## Exclusions
- Implementação visual completa das telas do client (escopo de `ux-release-readiness` / ITEM-71-75).
- Mudança de backend, contratos de API ou fluxos de agentes.
- Deploy/CI de release do Storybook (escopo de AC7 do `ds-catalog`).

## Acceptance Criteria
- [ ] **AC1 — Catálogo revisável sobe green**: `npm run storybook:build` (ou `npm run storybook`) conclui sem erro e expõe as 39 stories + Foundations para revisão humana.
- [ ] **AC2 — Theme-switch habilita revisão dark/light do rebrand**: toolbar do Storybook alterna `.dark`/`.light` (addon-themes) e os tokens de marca trocam de fato (verificado: root bg rgb(15,17,21)↔rgb(246,247,249)).
- [ ] **AC3 — Diff visual do rebrand documentado**: existe página/story mostrando estado atual vs. proposta do rebrand (cores de marca, logo, superfícies) para decisão humana.
- [ ] **AC4 — Sign-off humano registrado**: aprovação do rebrand consta no health/gate do harness (ou spec linked) antes do merge — ITEM-80.
- [ ] **AC5 — DS sem drift na data da release**: `npm run ds:check` e `npm run ds:validate` green; `npm -w packages/ui run typecheck` e `npm run test` green no workspace.

## Context
O repo já tem o catálogo do DS migrado para Storybook 8 (AC1-3 do `ds-catalog` concluídos e verificados no browser: addons essentials/a11y/themes ativos, tokens/typpography/motion como CSF stories). O próximo marco de produto é o rebrand (amber), que precisa de revisão e aprovação humana antes do ship. Esta spec congela os gates de release-readiness para que a aprovação seja observável e o rebrand não avance sem sinal humano.

Vinculado a: ITEM-80 (Product Rebrand). Catálogo de origem: `ds-catalog`.
