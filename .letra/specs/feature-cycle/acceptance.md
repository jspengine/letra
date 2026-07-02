## Acceptance Criteria

- [ ] **Seção no adapter OpenCode**: Instruções completas do ciclo com task(), todowrite(), bash()
- [ ] **Seção no adapter Cursor**: Instruções completas do ciclo com checkpoint a cada 2 ACs
- [ ] **Fase 1 — Entender**: pulse + ler spec + identificar ACs + criar plano
- [ ] **Fase 2 — Executar**: implementar → validate (+recovery) → pulse → sitrep → log → build (+recovery)
- [ ] **Fase 3 — Completar**: flow move --auto se todos ACs ✅, session-end, relato
- [ ] **Checkpoint no Cursor**: Instrução para pausar a cada 2 ACs em itens grandes
- [ ] **Sub-agentes no OpenCode**: Instrução para usar task() para ACs paralelos
- [ ] **Regras**: NUNCA criar spec, NUNCA mover para Done, NUNCA ignorar ACs, SEMPRE validar
- [ ] **Geração automática**: Seção gerada junto com adapters quando há item ativo
- [ ] **Sem item ativo**: Seção não aparece (sem ruído)
- [ ] **Registro no session-log**: Cada fase gera entradas no diário
- [ ] **Testes**: Seção OpenCode, seção Cursor, com/sem item ativo, checkpoint, sub-agentes
