# Spec: Spec-Code Drift Detector

> Updated: 2026-06-15

## Outcome

Um AC marcado como `[x]` (feito) no spec pode ficar defasado se o código é removido ou renomeado depois. Este detector re-valida ACs `[x]` contra o código-fonte periodicamente, similar ao `ac-false-pos` mas com escopo mais amplo (não só busca textual, mas também verifica exports, arquivos, e imports).

## Constraints

- Certeza 0.7 (suggest-only) — busca textual tem falsos positivos, igual ao `ac-false-pos`
- Opera em paralelo com outros detectores
- Usa o mesmo `searchInSource` do `ac-false-pos` mas varre spec inteiro, não só o acceptance.md
- Escaneia specs em estágio `code`, `review`, `done` (ignora `design` e `backlog` — ACs ainda não implementados)

## Architecture

```
detectors/spec-code-drift.ts
  → Lê cada spec com ACs `[x]`
  → Extrai command/name do AC (ex: "flow visualize")
  → Busca no source (camelCase, PascalCase, kebab-case)
  → Se não encontrado e spec está em code/review/done, sugere reverter para `[ ]`
```

## Acceptance Criteria

- [x] **Detector implementado**: Varre specs em code/review/done, re-valida ACs `[x]` contra source
- [x] **Ignora design/backlog**: ACs em specs não implementados não são verificados
- [x] **Suggest-only**: Certeza 0.7, não auto-corrige
- [x] **Testes**: Spec com AC `[x]` sem código → sugestão; spec com AC `[x]` com código → silêncio

## Exclusions

- Análise semântica (AST, type checking) — busca textual apenas
- Verificação de cobertura de testes (escopo de validate-ac-signal)
- Drift reverso (código existe mas AC `[ ]` — já coberto por ac-stale)

## Context

Este detector preenche a lacuna: `ac-stale` detecta `[ ]` que viram `[x]` (código novo), `ac-false-pos` detecta `[x]` sem código (falso positivo inicial). Mas se o código é removido DEPOIS do AC marcado `[x]`, nenhum dos dois detecta. `spec-code-drift` cobre esse caso.
