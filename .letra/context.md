# Context

> Updated: 2026-06-17T17:13:53.421Z
> Owner: letra-dev

## Intent

Letra é um framework de Specification-Driven Development (SDD) agnóstico a ferramentas.
Captura direção, intenção e contexto, enriquecendo prompts de agentes de código.

## Domínio

- **Produto**: CLI + adapters + formato de memória `.letra/` + SPA web UI
- **Público**: 1. Não-devs → 2. Devs → 3. Empresas (tarefas diversas)
- **Stack**: TypeScript, Node.js 22+, React 19 + Vite (web UI), distribuído via npm (npx)

<!-- sitrep:start -->
**Estágio**: Code
**Item atual**: ITEM-43 — Implementar adapter Hermes Agent (spec: adapter-hermes)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 1 novo(s) · 4 em acompanhamento · 39 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

<!-- sitrep:start -->
**Estágio**: Code
**Item atual**: ITEM-43 — Implementar adapter Hermes Agent (spec: adapter-hermes)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 8 novo(s) · 4 em acompanhamento · 32 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

<!-- sitrep:start -->
**Estágio**: Code
**Item atual**: ITEM-43 — Implementar adapter Hermes Agent (spec: adapter-hermes)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 1 novo(s) · 4 em acompanhamento · 39 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

<!-- sitrep:start -->
**Estágio**: Code
**Item atual**: ITEM-43 — Implementar adapter Hermes Agent (spec: adapter-hermes)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 1 novo(s) · 4 em acompanhamento · 39 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

<!-- sitrep:start -->
**Estágio**: Code
**Item atual**: ITEM-43 — Implementar adapter Hermes Agent (spec: adapter-hermes)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 1 novo(s) · 4 em acompanhamento · 39 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

<!-- sitrep:start -->
**Estágio**: Review
**Item atual**: ITEM-44 — Melhorias no harness e loop de execução — sincronia, testes, disciplina, animação real (spec: harness-loop-realtime)
**ACs**: 5/5 pendentes | 0 feito(s)
**Alertas**: 5 em acompanhamento · 40 resolvido(s)
**Últimas decisões**: "adapter hermes architecture" (17/06/2026), "write sync single source of truth" (16/06/2026), "harness composition model" (15/06/2026), "ux redesign ai memory hub" (14/06/2026)
<!-- sitrep:end -->

## Stack

- **Monorepo**: npm workspaces (`packages/cli`, `packages/client`, `packages/types`)
- **CLI**: Commander, tsup (build), Vitest (testes)
- **Web UI**: React 19, Vite 6, Tailwind v4 + `@tailwindcss/vite`, shadcn/ui-inspired componentes
- **Linting**: Biome
- **Runtime**: Node 22+, ESM (`"type": "module"`)
- **Zero dependências runtime externas** — `fetch()` nativo Node 22+

## Restrições Reais

- Specs devem ser thin (máx 1 página por feature)
- Sem lock-in de IDE — o formato `.letra/` é Markdown puro
- Drift detection deve funcionar para qualquer domínio (não só código)
- Pipeline CI/CD deve falhar se spec não for cumprida
- Web UI pré-compilado no build do pacote — usuário final só precisa de Node

## Porquês

- Escolhemos TypeScript porque 82% dos novos pacotes npm são TS em 2026
- Escolhemos Markdown checklist porque não-devs precisam ler e escrever specs
- Escolhemos adapter OpenCode primeiro para dogfooding imediato
- Escolhemos organização GitHub dedicada para identidade de produto
- Escolhemos OKLCH sobre HSL para percepção consistente entre matizes
- Escolhemos SPA React + Vite para web UI acessível a não-devs
