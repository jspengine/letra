# Spec: flow-mvp

> Updated: 2026-06-22

## Outcome

Usuário consegue definir seu processo de trabalho com 3 perguntas, visualizar o progresso no terminal, e mover itens entre estágios — com os adapters (AGENTS.md, CLAUDE.md, etc.) refletindo automaticamente o contexto do estágio atual para o LLM.

## Constraints

- Workflow armazenado em `.letra/flow/workflow.json` com versionamento semântico
- Adapter regenerado a cada `flow move` — sem delay, sem comando extra
- Board renderizado no terminal com tabela simples (sem dependências TUI externas)
- Wizard `--quick` deve ter no máximo 3 perguntas
- Cada comando deve funcionar independentemente dos outros
- Workflow.json deve ser portável entre projetos via export/import

## Exclusions

- **Automações**: webhooks, triggers condicionais, transições automáticas (v0.3+)
- **Skills engine**: agentes têm apenas descrição, não habilidades estruturadas (v0.3+)
- **Web UI**: sem servidor local ou interface gráfica (v0.3+)
- **Import de issues**: sem integração com GitHub Issues, Linear, etc. (v0.3+)
- **Regras obrigatórias**: reutilizar severity do `letra validate`, sem sistema novo

## Acceptance Criteria

- [x] **`flow init --quick`**: Wizard com 3 perguntas (nome, estágios, agentes) gera `.letra/workflow.json` válido.
- [ ] **`flow init` (sem `--quick`)**: Wizard completo com perguntas adicionais (artefatos, regras).
- [x] **`flow board`**: Exibe tabela com todos os estágios, quantidade de itens por estágio, e itens ativos.
- [x] **`flow move <id> --to <stage>`**: Move item entre estágios e regenera arquivos de adapter.
- [x] **`flow backlog add <desc>`**: Adiciona item ao backlog no primeiro estágio.
- [x] **`flow backlog list`**: Lista todos os itens com estágio atual e agente designado.
- [ ] **`flow visualize`**: Gera diagrama Mermaid do workflow atual.
- [ ] **`flow export`**: Exporta `workflow.json` para stdout.
- [ ] **`flow import <file>`**: Importa workflow de arquivo externo como nova versão.
- [x] **Adapter integrado**: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md` incluem estágio atual e regras aplicáveis após `flow move`.
- [ ] **Versionamento**: `flow edit` cria nova versão (`v1.0.0 → v1.1.0`), `flow diff v1 v2` mostra mudanças.

## Context

Decisão ADR em `.letra/decisions/flow-mvp-escopo-enxuto-3-comandos-valor-imediato.md`. Este MVP prioriza entrega rápida de valor em detrimento de automações complexas. O modelo de dados em `.letra/flow/` foi desenhado para ser extensível sem quebrar versões anteriores
