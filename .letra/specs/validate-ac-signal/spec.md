# Spec: Validate AC Signal — Relatório Completo de Critérios

> Updated: 2026-06-14
> Prioridade: **Alta** — companion de `harness-layer`
> Companion: corrige problema H-05 e H-06 da auditoria

## Outcome

`letra validate` reporta estado **completo** dos acceptance criteria — pendentes E concluídos — em vez de silenciar com "No criteria found" quando tudo está marcado. O agente e o CI sabem em uma linha: `ruler-header: 9/9 done` ou `flow-serve: 3/12 pending`. Divergência entre `spec.md` e `acceptance.md` gera warning explícito.

## Constraints

- Manter compatibilidade com `--format github-annotation` e `--format junit`
- Heurística local — sem LLM
- Preferir `acceptance.md` como fonte primária; `spec.md` como fallback (mesma regra do harness-layer)
- Exit code: `0` se nenhum AC pendente; `1` se há pendentes (comportamento atual preservado)
- Novo exit code não introduzido

## Comportamento atual (problema)

```
Spec: ruler-header
No criteria found
```

`validate.ts` linha 601: `criteriaLines = content.match(/- \[ \] \*\*(.+?)\*\*: (.+)/g)`

Só lista pendentes. Zero pendentes = silêncio = agente conclui erroneamente que validate não se aplica.

## Comportamento desejado

```
Spec: ruler-header
  ACs: 9/9 done (source: acceptance.md)
  ✓ DocumentView component
  ✓ RulerHeader fade
  ...
```

Com pendentes:

```
Spec: flow-serve
  ACs: 3/12 pending (source: acceptance.md)
  ✗ SSE endpoint
  ✗ Live reload
  ...
  ✓ flow serve starts
```

Com drift entre fontes:

```
Spec: ruler-header
  ⚠ ac-source-drift: acceptance.md=9 done, spec.md=0/12 done
  ACs: 9/9 done (source: acceptance.md, preferred)
```

## Nova heurística: ac-source-drift

| Condição | Severidade | Mensagem |
|----------|------------|----------|
| Ambos existem, contagem `[x]` difere > 0 | warning | `ac-source-drift: acceptance.md=N, spec.md=M` |
| Só spec.md tem ACs, acceptance.md ausente | info | `ACs sourced from spec.md (no acceptance.md)` |
| Nenhum AC em nenhum arquivo | warning | `No acceptance criteria defined` |

Registrar em `.letra/config.json` heuristics como `ac-source-drift` com severity configurável.

## Mudanças em validate.ts

1. Função `parseACs(content)` → `{ done: AC[], pending: AC[], total: number }`
2. Função `resolveACSource(specDir)` → `{ content, source: 'acceptance' | 'spec' }`
3. Função `detectACSourceDrift(specDir)` → warning ou null
4. Output sempre inclui linha resumo `ACs: X/Y pending` ou `ACs: Y/Y done`
5. Remover mensagem "No criteria found" — substituir por critérios acima

## Formato por saída

| Format | Resumo | Detalhe |
|--------|--------|---------|
| terminal (default) | colorido | lista ✓/✗ por AC |
| github-annotation | annotation por AC pendente | warning para drift |
| junit | testcase por AC | failure só em pendentes |

## Exclusions

- **Auto-sync spec ↔ acceptance** — responsabilidade do harness-layer / self-diagnosis
- **Validar implementação real** — continua sendo heurística de texto, não análise de código
- **Merge automático de ACs** — só reporta drift, não corrige

## Acceptance Criteria

Ver `.letra/specs/validate-ac-signal/acceptance.md`.

## Context

Agentes usam `letra validate` como sinal de "posso mover para Review?". Silêncio quando tudo está `[x]` é indistinguível de "spec sem critérios". Pior: quando `acceptance.md` diz done e `spec.md` diz pending, o agente recebe sinais contraditórios dependendo de qual arquivo lê.

Esta spec é independente do harness-layer mas compartilha `ac-counter.ts` — extrair para `packages/cli/src/lib/ac-parser.ts` usado por ambos.
