# ADR: SPA React + Vite para Flow UI

**Data:** 2026-06-08
**Contexto:** ITEM-13 — Flow Designer
**Status:** Aceita

## Problema

O frontend do Flow UI (`letra flow serve`) é gerado por uma template literal de 500+ linhas em `flow-serve.ts`. Cada nova funcionalidade (config de dashboard, kanban, CRUD de itens) torna a manutenção exponencialmente mais difícil. Precisamos de uma arquitetura frontend que escale com o produto.

## Decisão

Adotar **SPA React** com **Vite** como toolchain de build.

### Detalhes

- O SPA é **pré-compilado** no build do pacote (Vite → `dist/client/`)
- O usuário final **não instala React** — só Node.js
- O CLI (`letra flow serve`) serve assets estáticos + API REST no mesmo server
- Estrutura de monorepo leve: `packages/cli/` + `packages/client/`
- API continua REST (não GraphQL) — simplicidade sobre over-engineering
- Framework: React puro + `zustand` se estado global for necessário

### Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| HTMX + partials server-rendered | Não escala para UI rica (drag, kanban interativo, modais complexos) |
| HTML template literal | Já no limite — qualquer feature nova é luta |
| PWA | Complexidade extra sem necessidade imediata — SPA resolve agora |
| GraphQL | Overkill para ~5 entidades e 1 cliente |

## Consequências

**Positivas:**
- Componentização real (Dashboard, Kanban, SidePanel, StageConfig, etc.)
- Manutenção independente entre CLI e UI
- Ferramentas maduras para testes de UI
- Build otimizado (code splitting, lazy loading)

**Negativas:**
- Aumento de devDependencies no monorepo (React, Vite, etc.)
- Pipeline de build em dois estágios (CLI + Client)
- Curva de aprendizado para contribuidores não-familiarizados com React

**Neutras:**
- Separação em pacotes exige coordenação de versões entre CLI e Client

## Próximos passos

- ITEM-14: SPA React — setup do monorepo (packages/cli + packages/client)
- ITEM-15: Migrar endpoints REST existentes para o novo SPA
- ITEM-16: Configuração de dashboard via web (zones)
- ITEM-17: CRUD de itens no SPA
