# Spec: tui-onboarding

> Updated: 2026-06-22

## Outcome

Wizard interativo em TUI para `letra init`, com logo ASCII, navegação por teclado e preview antes de criar.

## Constraints

- Usa Ink (React para terminal).
- Fallback automático para modo texto se `TERM` não suportar.
- `--flags` pulam wizard (compatível com CI).

## Exclusions

- SPA embarcada no CLI.
- Suporte a temas customizados na TUI.

## Acceptance Criteria

- [x] Logo ASCII do letra aparece no topo do wizard.
- [x] Navegação por setas + Enter.
- [x] Preview do que será criado antes do apply.
- [x] Flag `--no-tui` cai para modo texto.
- [x] Progress indicator por passo.

## Context

UX primária para fluxos interativos. Onboarding é a primeira impressão do produto.
