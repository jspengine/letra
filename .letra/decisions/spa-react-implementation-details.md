# ADR: SPA React — Implementation Details

**Data:** 2026-06-08
**Contexto:** ITEM-14 — SPA React setup
**Status:** Aceita

## Decisões

### 1. API REST — convenções

| Método | Rota | Ação | Status |
|---|---|---|---|
| `GET` | `/api/workflow` | Obter workflow completo | 200 |
| `PUT` | `/api/workflow` | Substituir workflow (config) | 200 |
| `GET` | `/api/items` | Listar itens | 200 |
| `GET` | `/api/items/:id` | Obter um item | 200 |
| `POST` | `/api/items` | Criar item | 201 |
| `PATCH` | `/api/items/:id` | Atualizar parcial (stage, desc, tasks) | 200 |
| `DELETE` | `/api/items/:id` | Remover item | 204 |
| `GET` | `/api/specs` | Listar specs resolvidas | 200 |
| `GET` | `/api/specs/:id` | Obter spec por ID | 200 |
| `GET` | `/api/events` | SSE (workflow atualizado) | — |

- Nomes **plurais** sempre (`/items`, não `/item`)
- Sucesso: `{ data: ... }` | Erro: `{ error: string }`
- SSE mantido para reload automático multi-cliente

### 2. Tipos compartilhados

Pacote `packages/types/` com interfaces TS puras. CLI e Client importam via `@letra/types`. Sem runtime — só `export interface`.

### 3. Build em 2 estágios

```
client: vite build → dist/client/ (HTML + JS + CSS)
cli:    tsup → dist/index.js + copia dist/client/ para dist/client/
```

No dev, CLI faz proxy pro Vite dev server (`localhost:5173`) para HMR.

### 4. Testes

- **Vitest** para hooks, API clients, lógica — roda em `npm test` (rápido)
- **Playwright** para testes de regressão visual e fluxos — roda no CI apenas

## Alternativas consideradas

- API com nomes singulares (`/item`) → rejeitado: convenção REST é plural
- Tipos duplicados entre CLI e Client → rejeitado: shared package evita drift
- Testes só Vitest → rejeitado: fluxos críticos merecem Playwright
- Build manual sem cópia automatizada → rejeitado: `tsup` plugin resolve

## Consequências

- Deploy continua sendo `npm publish @letra/cli` — tudo num pacote
- CI precisa buildar client antes de CLI
- Playwright no CI aumenta tempo de pipeline
