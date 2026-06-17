# Spec: flow edit + flow diff

## Outcome
Usuário edita metadados do workflow diretamente via CLI (nome, descrição) e visualiza diferenças entre versões.

## Constraints
- `flow edit --name "Novo Nome"` altera o nome no workflow.json
- `flow edit --desc "Descrição"` altera a descrição
- Cada edição incrementa o versionamento (1.0.0 → 1.1.0) e salva backup da versão anterior
- `flow diff` compara workflow atual com último backup (`.letra/workflow.v1.0.0.json`)
- `flow diff <v1> <v2>` compara duas versões específicas
- Diff exibe: nome, estágios (adição/remoção), itens (novos/movidos/removidos)
- Sem workflow: exibe mensagem clara

## Exclusions
- Edição de estágios individuais (adição/remoção) — v0.4+
- Edição de itens individuais via comando
- Diff interativo com staging

## Acceptance Criteria
- [ ] **`letra flow edit --name "Novo"`**: atualiza nome e versiona
- [ ] **`letra flow edit --desc "Desc"`**: atualiza descrição
- [ ] **Versionamento**: incrementa (1.0.0 → 1.1.0) a cada edição
- [ ] **Backup**: da versão anterior é salvo
- [ ] **`flow diff`**: mostra diferenças entre atual e último backup
- [x] **`flow diff v1.0.0 v1.1.0`**: compara versões específicas
- [ ] **Testado localmente**: antes do PR

## Context
Feature P1 do Flow MVP. Versionamento semântico para rastrear mudanças no workflow.
