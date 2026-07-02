# Acceptance Criteria — Consolidação e Redesenho de Menus

- [ ] **AC1 — Remoção de itens inativos**: As abas desabilitadas na barra lateral (`Pull Requests`, `Monitoramento`, `Configurações`) são removidas/ocultadas da navegação principal.
- [ ] **AC2 — Unificação de estágios estáticos**: As abas estáticas e redundantes `Discovery` e `Design` são unificadas sob um único menu **"Pipeline"** (ou **"Fluxo de Execução"**).
- [ ] **AC3 — Menu dinâmico de pipeline**: O novo menu "Pipeline" exibe os estágios de forma dinâmica com base no harness ativo configurado no workspace, respeitando a autoridade de domínio.
- [ ] **AC4 — Inspeção do Harness**: O menu **"Harness"** é habilitado em modo leitura (*read-only*), permitindo ao usuário inspecionar as regras fundamentais, personas e templates do workspace carregados na sessão.
- [ ] **AC5 — Alinhamento de Terminologias**: O menu **"Conhecimento"** é renomeado para **"Contexto"** na barra lateral, harmonizando com o título interno da página ("Context").
- [ ] **AC6 — Rastreabilidade contextual na Auditoria**: As entradas da linha do tempo na Auditoria contêm links clicáveis direcionando para o item (`ITEM-X`) ou especificação correspondente quando estes existirem no workspace.
- [ ] **AC7 — Auditoria por Papel**: O filtro de ações/atores na Auditoria permite selecionar especificamente as personas configuradas no harness ativo (ex: `analyst`, `security`, `reviewer`).

