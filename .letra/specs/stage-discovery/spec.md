# Spec: stage-discovery

> Updated: 2026-06-22

## Outcome

O agente não precisa saber o nome do próximo estágio para mover um item. `letra flow move ITEM-X --auto` descobre automaticamente qual é o próximo estágio com base na ordem definida no workflow. O adaptador também mostra "Seu item está em X. Próximo: Y" para que o agente saiba antes de mover.

## Constraints

- `--auto` calcula o próximo estágio baseado na ordem crescente (`order` field) dos stages no workflow.json
- Se item está no último estágio (maior order), `--auto` não faz nada (já está no fim)
- Se workflow não tem stages definidos, `--auto` mostra erro amigável
- O adapter mostra estágio atual + próximo estágio para o item ativo
- A descoberta é local (lê workflow.json) — não requer API
- Funciona com qualquer workflow, independente de quantos estágios

## Exclusions

- Mover para estágio específico com `--auto` (`--auto --to code`) — use `--to` explícito para isso
- Multi-saltos (pular estágios) — `--auto` sempre vai para o próximo imediato
- Estágios paralelos (ex: Code e Review simultâneos) — ordem linear apenas

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

## Context

Este spec resolve o problema mais básico do handoff: o agente não sabe para QUAL estágio mover o item. "Próximo estágio" é óbvio para um humano que desenhou o workflow, mas não para um agente que acabou de chegar.

O `--auto` elimina a necessidade de o agente parsear workflow.json para descobrir a ordem. O adapter mostra o próximo estágio como informação adicional, mas o comando `--auto` é o que realmente resolve o problema.
