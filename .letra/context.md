# Context

> Updated: 2026-06-15
> Owner: letra-dev

## Intent

Letra é um framework de Specification-Driven Development (SDD) agnóstico a ferramentas.
Captura direção, intenção e contexto, enriquecendo prompts de agentes de código.

## Domínio

- **Produto**: CLI + adapters + formato de memória `.letra/` + SPA web UI
- **Público**: 1. Não-devs → 2. Devs → 3. Empresas (tarefas diversas)
- **Stack**: TypeScript, Node.js 22+, React 19 + Vite (web UI), distribuído via npm (npx)

## Estado Atual (2026-06-15)

- **Estágio**: Review
- **Itens correntes**: ITEM-33 (ruler header — revisão)
- **Recente**: 
  - SpecsView enriquecida (outcome, status, auto-validate, auto-select)
  - Header rebranding (amber + logo + Space Grotesk + favicon)
  - Scroll isolation corrigido (flex chain sem h-full)
  - Testes flow-move corrigidos
- **Web UI**: Flow designer, spec viewer, diagnostics dashboard, home health check
- **CLI**: init, flow move, flow board, spec management, diagnostics validation
- **Build**: 130/130 testes passando | Build limpo

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
