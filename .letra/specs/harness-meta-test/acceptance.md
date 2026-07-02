## Acceptance Criteria

- [x] **Detectores registrados**: engine.ts tem todos os 6 detectores do schema
- [x] **TTL correto**: snapshot.ts TTL_MS == 30 dias
- [x] **Consistência certeza/autoFix**: Todo detector com certainty ≥ 0.9 tem autoFix; < 0.9 não tem
- [x] **Auto-fix**: Se detector faltando, adiciona placeholder comentado (para desenvolvedor implementar)
- [x] **Testes**: Meta-teste verifica que harness-meta-test detecta intencionalmente um detector removido
- [x] **DevOnly filter**: Meta-teste verifica que detectores com `devOnly: true` são pulados quando `isLetraRepo()` retorna `false`
