# Spec: Harness Layer — Composição Agnóstica de Contexto

> Updated: 2026-06-14
> Prioridade: **Crítica** — bloqueia proposta central do produto

## Outcome

Todo evento que altera o contexto de trabalho (`init`, `flow move`, `focus`) regenera adapters (`.cursorrules`, `AGENTS.md`, `CLAUDE.md`, etc.) via **composição em camadas** — nunca substituindo referências por snapshot mínimo. O agente recebe, em ~40-60 linhas, ponte para `.letra/`, snapshot do workflow, sinais de trabalho (ACs pendentes, spec path, tasks) e regras de execução. O harness **melhora** conforme o time usa o workflow.

## Constraints

- **Thin adapter**: máximo 60 linhas por arquivo gerado; nunca inlinar conteúdo de `spec.md`
- **Fonte da verdade**: `.letra/` — adapter é view compilada, descartável, regenerável
- **Um builder**: `packages/cli/src/adapters/builder.ts` — único ponto de geração
- **N formatters**: `packages/cli/src/adapters/formatters/{cursor,opencode,claude-code,windsurf,vscode}.ts`
- **Zero deps externas** — leitura de `workflow.json`, `acceptance.md`, `focus.md` via fs
- **Backward compatible**: projetos existentes regeneram adapter correto no próximo `flow move` ou `focus`
- **Agnóstico**: mesmo `HarnessSnapshot` interno; só a sintaxe de referência muda por tool

## Modelo de dados interno

```typescript
interface HarnessSnapshot {
  workflowName: string;
  activeStage: { id: string; name: string };
  items: Array<{
    id: string;
    description: string;
    spec?: string;
    specPath?: string;       // .letra/specs/{id}/spec.md
    acceptancePath?: string; // .letra/specs/{id}/acceptance.md
    acPending: number;
    acTotal: number;
    tasksOpen: number;
    tasksTotal: number;
  }>;
  primaryItemId: string | null; // primeiro item no estágio ativo, ou item do flow move
  focusSpec: string | null;       // de focus.md ou derivado do item primário
  focusPath: string | null;
}
```

## Camadas do adapter (L1–L4)

### L1 — Referências always-on

Sempre presentes, independente de workflow:

| Tool | Sintaxe |
|------|---------|
| cursor, windsurf | `@.letra/context.md` etc. |
| opencode, claude-code, vscode | bullet list de paths |

Arquivos: `context.md`, `constitution.md`, `glossary.md`, `focus.md` (se existir).

### L2 — Workflow snapshot

```
## Workflow
**Estágio ativo:** Code

### Itens neste estágio
- ITEM-33 → spec: ruler-header
  - spec: .letra/specs/ruler-header/spec.md
  - acceptance: .letra/specs/ruler-header/acceptance.md
```

Se item não tem spec: apenas id + descrição (comportamento atual, enriquecido).

### L3 — Work signals

Bloco computado, inline, sem copiar ACs:

```
## Sinais de trabalho
**Item primário:** ITEM-33 (ruler-header)
**ACs:** 3/12 pendentes
**Tasks:** 0/0 abertas
```

Regras de cálculo AC:
1. Preferir `acceptance.md` se existir
2. Fallback para seção `## Acceptance Criteria` em `spec.md`
3. Contar `[ ]` como pendente, `[x]` como concluído
4. Se fontes divergem em contagem → incluir `⚠ ac-source-drift: spec.md=N, acceptance.md=M`

### L4 — Regras do agente

Estáticas, alinhadas à constitution:

```
## Regras
- Leia a spec do item primário antes de codificar
- Execute `letra validate` para verificar acceptance criteria
- Siga constitution.md rigorosamente
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`
```

## Sync de `focus.md`

| Evento | Comportamento |
|--------|---------------|
| `flow move <id> --to <stage>` | Se item tem `spec`, reescreve `focus.md` com formato padrão (`letra focus`) |
| `flow move` sem spec no item | Não altera `focus.md` existente |
| `letra focus <spec>` | Override manual; regenera adapters |
| `letra focus --clear` | Remove `focus.md`; regenera adapters sem referência a focus |

Formato `focus.md` unificado (mesmo de `focus.ts`):

```markdown
# Focus: ruler-header

**Path**: .letra/specs/ruler-header/
**Item**: ITEM-33
**Outcome**: Todo painel de leitura de documento...
```

## Refatoração de código

```
packages/cli/src/adapters/
├── builder.ts          — monta HarnessSnapshot a partir do root
├── ac-counter.ts       — conta ACs de acceptance.md ou spec.md
├── focus-sync.ts       — read/write focus.md
├── generate.ts         — orquestra: snapshot → formatters → write files
└── formatters/
    ├── cursor.ts       — sintaxe @
    ├── text.ts         — bullet paths (opencode, claude, vscode)
    └── windsurf.ts     — sintaxe @
```

`init.ts` e `flow-move.ts` passam a chamar `generateAdapters(root, tools, options?)`.

`focus.ts` chama `generateAdapters` após write/clear de focus.

## Fases de implementação

### Fase 1 — Composição (bloqueante)

- Extrair builder + formatters
- `flow move` compõe L1+L2+L3+L4 (elimina H-01)
- Testes: adapter pós-init ≡ adapter pós-move em L1

### Fase 2 — Work signals + focus sync

- AC counter + spec paths em L2/L3 (elimina H-02, H-07)
- `flow move` sync focus.md (elimina H-03)
- Testes: move item com spec → focus.md atualizado

### Fase 3 — Detecção ac-source-drift

- L3 alerta quando `spec.md` e `acceptance.md` divergem (elimina H-06)
- Novo detector em self-diagnosis: `harness-stale` — adapter sem L1 references

### Fase 4 — Deprecar Estado Atual em context.md

- Remover § "Estado Atual" de `context.md` do dogfood
- Atualizar template de init para não incluir seção dinâmica (elimina H-04)
- Atualizar specs `adapter-*` — remover exclusion "sem sync automático"

## Exclusions

- **Inlinar spec no adapter** — sempre referenciar path
- **Sync em tempo real via SSE** — regeneração síncrona nos comandos basta
- **Escolher item primário por heurística complexa** — primeiro item no estágio ou item do `flow move`
- **Plugin de IDE** — continua arquivo na raiz
- **LLM para resumir spec** — sinais são contagem e path, não semântica

## Acceptance Criteria

Ver `.letra/specs/harness-layer/acceptance.md`.

## Context

A auditoria de 2026-06-14 provou que o Letra piora o harness com uso normal do workflow. Isso invalida o pitch "memória persistente para agentes" na prática, mesmo com specs excelentes em `.letra/specs/`.

A correção preserva todos os princípios do produto:

| Princípio | Como preservamos |
|-----------|------------------|
| Thin specs | Adapter referencia, não copia |
| Agnóstico | Um snapshot, N formatters |
| `.letra/` fonte da verdade | Adapter é view descartável |
| Workflow engine | `flow move` continua sendo o gatilho — mas agora compõe |
| Dogfood | Resolver no próprio repo antes de v0.5.0 |

Relacionado: spec `validate-ac-signal` (companion) corrige o sinal enganoso do `letra validate` — problema H-05, independente mas igualmente crítico para agentes.
