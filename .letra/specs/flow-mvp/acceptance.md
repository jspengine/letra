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
