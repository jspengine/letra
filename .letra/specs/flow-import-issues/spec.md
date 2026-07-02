# Spec: flow-import-issues

> Updated: 2026-06-22

## Outcome

Usuário importa tarefas de qualquer ferramenta (GitHub, Linear, Jira, Trello, etc.) para o backlog do flow, usando um formato JSON padrão — sem depender de integrações específicas.

## Constraints

- Zero dependências externas
- Formato único de import via JSON (pipe via stdin ou arquivo)
- Cada ferramenta pode gerar o JSON com um script de 5 linhas
- Validação na importação: rejeita itens genéricos demais
- Itens importados vão para o primeiro estágio do workflow

## Exclusions

- Sincronização bidirecional (import-only)
- Autenticação OAuth interativa
- Conectores nativos para cada ferramenta (o usuário gera o JSON)

## Acceptance Criteria

- [ ] **`flow backlog import`** aceita JSON via stdin (pipe)
- [ ] **`flow backlog import <file.json>`** aceita arquivo JSON
- [ ] Valida `title` obrigatório
- [ ] Valida `description` ≥ 30 caracteres
- [ ] Valida `title` ≠ `description`
- [ ] Emite warning para itens sem `acceptanceCriteria`
- [ ] Emite warning para itens sem `labels`
- [ ] Detecta duplicatas por similaridade de título
- [x] Se não há workflow, exibe "Run 'letra flow init --quick' first"
- [ ] Se JSON inválido, exibe erro amigável

## Context

Feature v0.3.0 do Flow. Após discussão de refino, decidiu-se por formato JSON genérico em vez de comandos por ferramenta — desacopla o flow dos providers e permite qualquer ferramenta se integrar sem modificação no código..
