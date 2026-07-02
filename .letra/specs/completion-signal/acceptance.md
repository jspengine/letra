## Acceptance Criteria

- [x] **Seção "Checklist de Encerramento"**: Aparece no adaptador quando workflow existe
- [x] **3 estados**: CONTINUE, BLOCKED, ALL_DONE com descrições claras
- [x] **Detecção por pulse**: O protocolo usa `letra pulse --json` para determinar estado
- [x] **BLOCKED**: Instrui agente a relatar e encerrar, não continuar
- [x] **ALL_DONE**: Instrui agente a gerar relato completo e encerrar
- [x] **CONTINUE**: Instrui agente a relatar progresso e decidir se continua ou para
- [x] **Limite de sessão**: Se >30 min de trabalho, instrui a pausar e relatar
- [x] **Relato de sessão**: Template de relato com itens, ACs, alertas, decisões
- [x] **Regeneração**: Seção atualizada quando adapters são gerados
- [x] **Testes**: Seção com cada estado (continue, blocked, all_done)
