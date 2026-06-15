# Harness Layer Audit — Análise Imparcial (2026-06-14)

> Auditoria conduzida com agente Cursor sobre o estado real do dogfood do Letra.
> Objetivo: verificar se a camada de harness cumpre a proposta do produto — agnóstica a ferramentas, enriquecendo prompts sem piorar com o uso do workflow.

---

## Escopo da auditoria

| Pergunta | Método |
|----------|--------|
| O harness injeta contexto suficiente para continuar trabalho? | Inspeção do que o Cursor recebe em `always_applied_workspace_rules` |
| O `flow move` melhora ou piora o harness? | Diff entre output de `init` vs `flow move` em `flow-move.ts` e `init.ts` |
| As fontes de memória estão coerentes? | Cruzamento de `.cursorrules`, `focus.md`, `context.md`, `workflow.json` |
| O `validate` orienta o agente corretamente? | Execução de `letra validate` + leitura de `validate.ts` |
| O código reflete o que as specs dizem? | Grep em `packages/client` vs `ruler-header` spec |

---

## Veredito

**O Letra não está otimizado para uso por agentes no estado atual.** A camada de harness é insuficiente como memória de trabalho. O agente consegue operar apenas porque possui ferramentas de exploração do repositório — não porque o Letra alimentou o contexto.

**Gravidade:** Alta. O problema é regressivo: quanto mais o time usa `flow move` (comportamento central do produto), pior fica o harness.

---

## Evidência 1 — O que o agente recebe hoje

Conteúdo injetado via `.cursorrules` / `AGENTS.md` após `flow move`:

```markdown
# Letra Context — letra
## Workflow
**Estagio atual:** Code
### Itens neste estagio
- ITEM-33: ruler header — DocumentView reutilizável...
### Regras
- Leia as specs em .letra/specs/ antes de codificar
- Execute `letra validate` para verificar acceptance criteria
- Siga a constitution.md rigorosamente
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`
```

**~17 linhas.** Ausente:

- Referências `@` a `context.md`, `constitution.md`, `glossary.md`, `focus.md`
- Caminho da spec vinculada (`ruler-header`)
- Outcome, constraints, exclusions
- Contagem de ACs pendentes
- Tasks não concluídas
- Sinal de implementação parcial no código

---

## Evidência 2 — Regressão no `flow move`

### `letra init` (correto)

Gera adapter com referências thin aos arquivos `.letra/`:

```
# Context
@.letra/context.md
@.letra/constitution.md
@.letra/glossary.md
@.letra/focus.md
```

### `letra flow move` (regressivo)

Substitui o adapter inteiro por snapshot mínimo de workflow — **sem referências, sem spec links**.

Código: `packages/cli/src/commands/flow-move.ts` → `adapterContent()` gera apenas estágio + lista de itens (id + descrição).

**Violação direta** da spec `adapter-cursor`: *"Manter `.cursorrules` thin — referenciar arquivos `.letra/`, não duplicar conteúdo."*

O `flow move` não duplica — mas **remove as referências**, o que é pior para o agente.

---

## Evidência 3 — Fontes dessincronizadas

| Artefato | Estado declarado | Confiável? |
|----------|------------------|------------|
| `workflow.json` | ITEM-33, stage `code`, spec `ruler-header` | ✅ Sim |
| `.cursorrules` | ITEM-33, stage Code | ⚠️ Parcial (sem spec link) |
| `focus.md` | ITEM-25, spec `design-system` | ❌ Errado |
| `context.md` § Estado Atual | ITEM-12, stage Design | ❌ Errado |

O agente não tem uma fonte única confiável sem investigação manual.

**Causa raiz:** `focus.md` e `context.md` são atualizados manualmente ou por comandos isolados (`letra focus`), mas `flow move` não os sincroniza.

---

## Evidência 4 — `letra validate` com sinal enganoso

Para `ruler-header`, validate retorna `No criteria found`.

**Causa:** `validate.ts` linha 601 só considera ACs **não marcados** (`- [ ]`). Quando `acceptance.md` tem tudo `[x]`, o output é silencioso.

**Conflito adicional:**

| Arquivo | Estado dos ACs |
|---------|----------------|
| `acceptance.md` | 9/9 marcados `[x]` |
| `spec.md` § Acceptance Criteria | 12 itens `[ ]` |

O agente que confia no validate conclui "nada a fazer". O agente que lê `spec.md` conclui "12 pendentes".

---

## Evidência 5 — Drift spec ↔ código (dogfood)

Item auditado: ITEM-33 / `ruler-header`

| Esperado (spec) | Real (código) |
|-----------------|---------------|
| `DocumentView` usado em SpecsView, ContextView, FlowView | `MarkdownView` em SpecsView/ContextView; `FlowView` usa `<Markdown>` cru |
| `DocumentView.tsx` como container padrão | Arquivo existe mas **não é importado** em nenhuma view |
| Diagnóstico per-spec na SpecsView | Não implementado |
| `extractMarkdownSections` em DocumentView | Duplicado em MarkdownView e DocumentView |

O harness não comunica este gap. O problema de "spec-code drift" que o Letra promete resolver **ocorre no próprio repositório**.

---

## Problemas catalogados (prioridade)

| ID | Problema | Severidade | Regressivo? |
|----|----------|------------|-------------|
| H-01 | `flow move` substitui adapter em vez de compor | Crítica | Sim |
| H-02 | Item → spec link ausente no harness | Alta | — |
| H-03 | `focus.md` dessincronizado do workflow | Alta | Sim |
| H-04 | `context.md` § Estado Atual obsoleto | Média | Sim |
| H-05 | `validate` silencia quando ACs estão `[x]` | Alta | — |
| H-06 | `spec.md` vs `acceptance.md` divergem | Alta | — |
| H-07 | Work signals (tasks, AC count) ausentes | Média | — |
| H-08 | Lógica de adapter duplicada em `init.ts` e `flow-move.ts` | Média | — |
| H-09 | Specs `adapter-*` desatualizadas (exclusion "sem sync") | Baixa | — |

---

## O que funciona (factual)

1. Formato `.letra/specs/` — quando lido manualmente, a spec é suficiente para implementar.
2. `workflow.json` — modelo de dados correto para item, estágio, spec link.
3. Arquitetura multi-adapter — mesmo evento gera `.cursorrules`, `AGENTS.md`, etc.
4. Regras genéricas no adapter — direção correta, execução insuficiente.

---

## Princípios para correção (sem ferir o produto)

1. **Compor, nunca substituir** — adapter é view compilada, não fonte da verdade.
2. **Thin sempre** — referenciar arquivos `.letra/`, nunca colar spec inteira no adapter.
3. **Sinais computados, não duplicados** — contagem de ACs, paths, tasks: inline mínimo.
4. **Um escritor** — módulo `adapters/` único; `init` e `flow move` chamam o mesmo builder.
5. **Estado dinâmico no workflow** — `context.md` para intent estável; snapshot de workflow no adapter.
6. **Agnóstico** — mesmo modelo para Cursor (`@`), Claude Code (paths), OpenCode (paths).

---

## Artefatos de resolução

| Artefato | Caminho |
|----------|---------|
| ADR — modelo de composição | `.letra/decisions/harness-composition-model.md` |
| Spec principal | `.letra/specs/harness-layer/spec.md` |
| Acceptance criteria | `.letra/specs/harness-layer/acceptance.md` |

---

## Próximo passo operacional

Adicionar ao backlog do workflow:

- **ITEM-34** (sugerido): harness-layer — composição de adapters + sync de focus + work signals
- **ITEM-35** (sugerido): validate-ac-signal — relatório de ACs concluídos vs pendentes + detector ac-source-drift

Ambos bloqueiam a promessa central do produto até resolvidos.
