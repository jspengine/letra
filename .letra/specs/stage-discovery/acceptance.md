## Acceptance Criteria

- [ ] **`--auto`**: `letra flow move ITEM-X --auto` descobre próximo estágio por order
- [ ] **Último estágio**: Se item já está no último, exibe mensagem e não move
- [ ] **Stage ausente**: Se stage do item não existe no workflow, erro amigável
- [ ] **Item ausente**: Se item não existe, erro amigável
- [ ] **Adapter mostra**: Seção do workflow no adaptador mostra "Próximo estágio: X"
- [ ] **Adapter comando**: Mostra `letra flow move ITEM-X --auto` como ação
- [ ] **Sem stages**: Se workflow não tem stages, erro amigável
- [ ] **Ordem correta**: Usa `stage.order` ascendente — não assume posição no array
- [ ] **Compatibilidade**: Funciona com workflows de 2 a N estágios
- [ ] **Testes**: Mover 1o estágio, mover estágio intermediário, mover último, adapter info, workflow sem stages
