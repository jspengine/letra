# Harness Composition Model — Compor, nunca substituir

**Date**: 2026-06-14
**Status**: accepted

## Context

Auditoria de 2026-06-14 (`.letra/docs/harness-layer-audit.md`) confirmou regressão crítica: `letra flow move` substitui o conteúdo gerado por `letra init`, removendo referências a `context.md`, `constitution.md`, `glossary.md` e `focus.md`. O adapter passa de útil a inútil conforme o time usa o workflow — exatamente o oposto da proposta do produto.

As specs `adapter-*` e `session-focus` assumem referências persistentes. O `flow-mvp` ADR declarou "regenera adapters automaticamente" no `flow move`, mas não especificou *como* compor o conteúdo. A implementação atual trata regeneração como substituição total.

Agentes de código (Cursor, Claude Code, Codex, OpenCode) dependem de arquivos na raiz do projeto como ponte para `.letra/`. Sem essa ponte, o formato `.letra/` existe mas não chega ao prompt.

## Decision

Adotar o **Harness Composition Model**: o adapter é uma **view compilada** em camadas, regenerada atomicamente por um único módulo (`packages/cli/src/adapters/`).

### Camadas do adapter (ordem fixa)

```
┌──────────────────────────────────────────────────────┐
│ ADAPTER — view compilada, máx ~60 linhas             │
├──────────────────────────────────────────────────────┤
│ L1 — Referências always-on                           │
│      context, constitution, glossary, focus          │
│      (sintaxe por ferramenta: @ ou path list)        │
├──────────────────────────────────────────────────────┤
│ L2 — Workflow snapshot                               │
│      estágio ativo, itens no estágio, spec link     │
├──────────────────────────────────────────────────────┤
│ L3 — Work signals (computados, inline)             │
│      ACs pendentes/total, tasks abertas, item primário│
├──────────────────────────────────────────────────────┤
│ L4 — Regras do agente (estáticas, constitution)      │
│      ler spec, validate, flow move ao concluir       │
└──────────────────────────────────────────────────────┘
```

### Regras invioláveis

| Regra | Motivo |
|-------|--------|
| Nunca colar conteúdo de spec no adapter | Thin spec; `.letra/` é fonte da verdade |
| Nunca remover L1 em regeneração | Composição, não substituição |
| L3 só com dados computados de `.letra/` | Sem duplicação manual |
| Um builder, N formatters | Agnóstico: mesmo modelo, sintaxe por tool |
| Regenerar em: `init`, `flow move`, `focus` | Todo evento que muda contexto de trabalho |

### Sync de `focus.md`

- `flow move` atualiza `focus.md` automaticamente para o item movido (se tiver `spec` vinculada).
- `letra focus <spec>` continua como override manual explícito.
- `letra focus --clear` remove foco; adapter L1 referencia condicionalmente.

### `context.md` § Estado Atual

- **Deprecar** atualização manual de "Estado Atual" em `context.md`.
- Estado dinâmico vive em `workflow.json` + adapter L2.
- `context.md` retém apenas intent, domínio, stack, restrições e porquês (estáveis).

### Eventos de regeneração

| Comando | Regenera adapters | Atualiza focus.md |
|---------|-------------------|-------------------|
| `letra init` | ✅ | ❌ |
| `letra flow move` | ✅ | ✅ (item movido) |
| `letra focus <spec>` | ✅ | ✅ (manual) |
| `letra focus --clear` | ✅ | ✅ (remove) |

## Consequences

**Positivo:**

- Harness melhora com uso do workflow, não piora.
- Agentes recebem ponte estável para `.letra/` + sinais de trabalho.
- Código de adapter deixa de estar duplicado em `init.ts` e `flow-move.ts`.
- Modelo extensível para novos adapters sem reescrever lógica.

**Negativo:**

- Adapter fica ~2× maior (~40-60 linhas vs ~17), ainda dentro do limite thin.
- `flow move` ganha side-effect em `focus.md` — pode surpreender quem usava focus manual para outra spec.
- Specs `adapter-*` precisam atualizar exclusion "sem sync automático".

**Mitigação do side-effect focus:**

- `letra focus <spec>` após `flow move` sobrescreve foco automático (override explícito vence).
- Documentar em `session-focus` spec.

## Alternativas rejeitadas

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| Inlinar spec completa no adapter | Viola thin spec; explode tokens |
| Não regenerar no flow move | Mantém regressão; workflow e harness dessincronizam |
| Só atualizar focus, não adapter | Agentes que não leem focus continuam sem contexto |
| Webhook/SSE para sync em tempo real | Complexidade prematura; regeneração síncrona basta |

## Referências

- `.letra/docs/harness-layer-audit.md`
- `.letra/specs/harness-layer/spec.md`
- `.letra/specs/session-focus/spec.md`
- `.letra/specs/adapter-cursor/spec.md`
