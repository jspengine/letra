## Acceptance Criteria

- [x] **TTL_MS = 30 dias**: `snapshot.ts` calcula `30 * 24 * 60 * 60 * 1000`
- [x] **Cleanup atualizado**: Snapshots entre 7 e 30 dias não são mais removidos prematuramente
- [x] **Teste ajustado**: Se existe teste com TTL hardcoded, atualizar
