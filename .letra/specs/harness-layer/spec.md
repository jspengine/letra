# Spec: harness-layer

> Updated: 2026-06-22

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
