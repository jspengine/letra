# Spec: tool-adapters

> Updated: 2026-06-23

## Outcome
O desenvolvedor consegue monitorar na interface web quais adaptadores de arquivos (.cursorrules, CLAUDE.md, etc.) estão ativos, configurados e sincronizados no repositório ativo.

## Constraints
- Deve apenas ler arquivos locais do repositório para validar a existência e data de modificação dos arquivos de adaptadores.
- Não deve conter dependências externas proprietárias para IDEs específicas.

## Exclusions
- Instalação automatizada de extensões de IDE (somente configuração de arquivos de regras do workspace).

## Acceptance Criteria
- [ ] **AC1**: Painel visual de adaptadores exibindo Cursor, Claude Code, Windsurf, Copilot, Hermes e OpenCode.
- [ ] **AC2**: Indicador visual do status de sincronização (Verde se data de modificação bate com a última compilação de flow move).
- [ ] **AC3**: Botão individual e global para forçar sincronização (`letra sync`) na UI.
- [ ] **AC4**: Exibição dos metadados de leitura/escrita de cada adaptador.

## Context
Centralizar as ferramentas agenticas. Como cada desenvolvedor ou agente de IA pode usar IDEs diferentes, a UI deve unificar o estado das regras de instrução do workspace.
