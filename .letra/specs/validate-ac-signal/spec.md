# Spec: validate-ac-signal

> Updated: 2026-06-22

## Outcome

`letra validate` reporta estado **completo** dos acceptance criteria — pendentes E concluídos — em vez de silenciar com "No criteria found" quando tudo está marcado. O agente e o CI sabem em uma linha: `ruler-header: 9/9 done` ou `flow-serve: 3/12 pending`. Divergência entre `spec.md` e `acceptance.md` gera warning explícito.

## Constraints

- Manter compatibilidade com `--format github-annotation` e `--format junit`
- Heurística local — sem LLM
- Preferir `acceptance.md` como fonte primária; `spec.md` como fallback (mesma regra do harness-layer)
- Exit code: `0` se nenhum AC pendente; `1` se há pendentes (comportamento atual preservado)
- Novo exit code não introduzido

## Exclusions

- **Auto-sync spec ↔ acceptance** — responsabilidade do harness-layer / self-diagnosis
- **Validar implementação real** — continua sendo heurística de texto, não análise de código
- **Merge automático de ACs** — só reporta drift, não corrige

## Acceptance Criteria

Ver `.letra/specs/validate-ac-signal/acceptance.md`.

## Context

Agentes usam `letra validate` como sinal de "posso mover para Review?". Silêncio quando tudo está `[x]` é indistinguível de "spec sem critérios". Pior: quando `acceptance.md` diz done e `spec.md` diz pending, o agente recebe sinais contraditórios dependendo de qual arquivo lê.

Esta spec é independente do harness-layer mas compartilha `ac-counter.ts` — extrair para `packages/cli/src/lib/ac-parser.ts` usado por ambos.
