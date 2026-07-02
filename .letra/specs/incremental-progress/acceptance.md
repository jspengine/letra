## Acceptance Criteria

- [ ] **3 cenários documentados**: FULL (move), PARTIAL (log + não move), NONE (log + não move)
- [ ] **Handoff-rules atualizado**: Passo 4 substituído pelos 3 cenários
- [ ] **Progresso parcial**: SÓ move quando todos ACs concluídos — nunca antes
- [ ] **Registro**: `letra log add` usado para marcar progresso parcial
- [ ] **Detecção**: Agente usa `letra pulse --json` para comparar AC counts antes/depois
- [ ] **Continuidade**: session-log + pulse permitem retomar exatamente de onde parou
- [ ] **Tasks não bloqueiam**: Tasks podem ficar abertas mesmo com item movido (só ACs importam)
- [ ] **Testes**: Cenário FULL move, PARTIAL não move e registra, NONE não move e registra
