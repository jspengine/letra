# Spec: Fix TTL Mismatch

> Updated: 2026-06-15

## Outcome

O TTL de snapshots no código (7 dias) diverge do especificado (30 dias em self-diagnosis-core:12). Alinhar para que spec e implementação concordem.

## Constraints

- Mudança de uma constante: `TTL_MS` em `snapshot.ts`
- Não alterar `MAX_SNAPSHOTS` (20) — é independente

## Acceptance Criteria

- [x] **TTL_MS = 30 dias**: `snapshot.ts` calcula `30 * 24 * 60 * 60 * 1000`
- [x] **Cleanup atualizado**: Snapshots entre 7 e 30 dias não são mais removidos prematuramente
- [x] **Teste ajustado**: Se existe teste com TTL hardcoded, atualizar

## Exclusions

- Mudança no formato de snapshot ou na lógica de dedup
- Adição de TTL configurável via config.json (fora de escopo)

## Context

TTL de 7 dias foi implementado para desenvolvimento inicial. O spec sempre disse 30 dias. Corrigir agora antes que usuários confiem em snapshots que expiram cedo demais.
