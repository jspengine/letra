# Adapter Hermes Agent — Architecture Decision

**Date**: 2026-06-17
**Status**: accepted

## Context

O **Hermes Agent** (desktop GUI app da Nous Research) precisa consumir o contexto do Letra (workflow, item ativo, ACs, alertas, comandos) para enriquecer o system prompt do LLM. Hoje o Letra suporta 6 adapters: `cursor`, `claude-code`, `windsurf`, `vscode` (Copilot), `opencode` (AGENTS.md), todos regenerados automaticamente a cada `flow move`, `focus` ou `init`.

**Problema**: Usuários do Hermes não têm adapter dedicado. O workaround seria usar `AGENTS.md` (formato genérico), mas:
1. Colisão se o projeto já usa `AGENTS.md` para outro agente (ex: OpenCode)
2. O Hermes pode evoluir para formato próprio (`.hermes/instructions.md`)
3. Viola o princípio *domain-agnostic* — cada tool tem seu caminho dedicado

**Restrições do projeto (constitution.md)**:
- Adapter layer desde o dia 1 — nunca travar em uma IDE
- Formato `.letra/` é a fonte da verdade
- CLI extensível via plugins
- **Separação de domínios**: `validation/` e `diagnostics/` não se importam mutuamente
- **Thin wrappers**: Commands CLI ≤100 linhas, orquestram shared modules
- **Funções puras**: Shared modules exportam funções puras, sem estado global
- **Template-driven**: Formatters geram strings; builders preparam dados

## Decision

**Adotar a arquitetura de "uma linha + arquivo dedicado"**:

1. **Adicionar `hermes` em `TOOL_TARGETS`** (`packages/cli/src/adapters/generate.ts:14-24`):
   ```typescript
   hermes: { path: ".hermes/instructions.md", format: "text", displayName: "Hermes Agent" }
   ```

2. **Formato `text`** (igual a `AGENTS.md`, `CLAUDE.md`) — o Hermes já entende esse formato

3. **Caminho dedicado**: `.hermes/instructions.md` — evita colisão com outros agentes

4. **Zero mudanças em `builder.ts`, `formatters.ts`, `generate.ts`** — reutilização 100%:
   - `buildHarnessSnapshot()` já constrói snapshot completo (workflow, items, alerts, focus)
   - `formatAdapterContent()` já formata L1, L5, Kickoff, Commands, Completion, Rules
   - `generateAdapters()` já itera `TOOL_TARGETS` e escreve arquivos

5. **Hook automático**: `flow-move.ts:84` chama `writeWorkflow` com `workflow.tools` — se `"hermes"` estiver no array, gera automaticamente

6. **Workflow tools array**: `flow init --quick` pergunta "Quais agentes?" e salva no `workflow.json`

7. **Test Strategy** (regra do projeto):
   - **Unit tests**: `hermes.test.ts` — Vitest, cobertura exemplar
   - **Property-based tests**: `hermes.property.test.ts` — `fast-check` para invariantes
   - **Mutation testing**: Stryker com **threshold ≥80% mutation score** (CI gate)
   - **Integration test**: `flow-move.integration.test.ts` — temp dir, `flow move` → arquivo gerado válido

## Consequences

### Positivo
- **Zero breaking changes** — nenhum módulo existente modificado além de 1 linha em `TOOL_TARGETS`
- **Reutilização máxima** — 100% do builder/formatters/generate reaproveitados
- **Consistência** — mesmo formato, mesmas seções, mesmos comandos dos outros 6 adapters
- **Isolamento** — `.hermes/instructions.md` não colide com `AGENTS.md` ou `CLAUDE.md`
- **Qualidade forçada** — mutation testing + property-based testing como gate (regra adotada no projeto)
- **Domain-agnostic** — funciona em projetos C#, Python, Go, Rust, sem Node (só escreve arquivo)

### Negativo
- **Mais um target** para manter — mas surface area mínima (1 entrada em objeto)
- **Hermes pode mudar formato** — mitigado: adapter isolado, só toca `hermes.ts` + tests
- **Mutation testing adiciona tempo no CI** — aceitável: qualidade > velocidade para adapters críticos

### Riscos Mitigados
| Risco | Mitigação |
|-------|-----------|
| Hermes muda formato | Adapter isolado; só `hermes.ts` + tests mudam |
| Colisão com `AGENTS.md` | Caminho dedicado `.hermes/instructions.md` |
| Mutation score baixo | Property tests cobrem invariantes; threshold 80% força qualidade |
| Projeto sem Node | Adapter só escreve arquivo — zero runtime dependency |
| `flow-claim` hardcoda `opencode` | Spec `npm-agnostic` já nota; adapter Hermes não usa `claimedBy` |

## Alternativas Consideradas

### 1. Reusar `AGENTS.md` (formato genérico)
**Rejeitado**: Colisão real se projeto usa OpenCode + Hermes simultaneamente. `AGENTS.md` é "owned" pelo OpenCode no ecossistema Letra.

### 2. Formato `@` style (como `.cursorrules`)
**Rejeitado**: Hermes consome `AGENTS.md`/`CLAUDE.md` (text format). Formato `@` é para Cursor/Windsurf.

### 3. Adapter separado (novo módulo `adapters/hermes/` com builder/formatters próprios)
**Rejeitado**: Viola DRY e `constitution.md` (shared modules, template-driven). Duplicaria 300+ linhas de lógica idêntica.

### 4. Plugin externo (fora do monorepo)
**Rejeitado**: Adapters são core do Letra; usuários esperam `letra flow move` regenerar *todos* adapters configurados sem setup extra.

## Implementation Notes

**Arquivos a criar/modificar**:
| Arquivo | Tipo | Linhas |
|---------|------|--------|
| `packages/cli/src/adapters/hermes.ts` | Novo (entry point, reexporta + target) | ~15 |
| `packages/cli/src/adapters/hermes.test.ts` | Novo (unit) | ~80 |
| `packages/cli/src/adapters/hermes.property.test.ts` | Novo (property) | ~60 |
| `packages/cli/src/commands/flow-move.integration.test.ts` | Novo (integration) | ~50 |
| `packages/cli/src/adapters/generate.ts` | Modificar (+1 linha em TOOL_TARGETS) | +1 |
| `packages/cli/src/commands/flow-init.ts` | Modificar (+1 opção no prompt) | +1 |
| `AGENTS.md` (raiz) | Modificar (documentar hermes) | +1 |

**Mutation Testing Setup** (já no projeto via `npm-agnostic` spec):
- `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`
- `npm run test:mutants` roda Stryker
- CI falha se mutation score < 80%

**Property-Based Testing**:
- `fast-check` já em deps (usado em outros detectors)
- Invariantes: snapshot consistency, header por source, alertas filtering, primaryItemId ∈ items

## Links

- Spec: `.letra/specs/adapter-hermes/spec.md`
- Workflow item: `ITEM-43`
- Adapters existentes: `packages/cli/src/adapters/generate.ts` (TOOL_TARGETS)