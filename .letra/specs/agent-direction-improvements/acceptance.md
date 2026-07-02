# Acceptance Criteria — Melhorias no Direcionamento de Agentes

- [ ] **AC1 — Agregação de conflitos**: O validador de conflito (`validate-conflict`) agrupa avisos redundantes ou repetidos de uma mesma especificação, reduzindo o número total de alertas de aviso individuais exibidos ao usuário e agente.
- [ ] **AC2 — Hiperlinks no CLI (Adaptadores)**: Outputs gerados pelo CLI para arquivos markdown (como `AGENTS.md` e `.letra/focus.md`) incluem links clicáveis padrão markdown no esquema `file:///` para as especificações, itens e regras citados.
- [ ] **AC3 — Links de arquivos no terminal**: O comando `letra pulse` e `letra status` exibe arquivos com formato URL `file:///` nas saídas do console para facilitar o acesso rápido por IDEs/Agentes compatíveis.
- [ ] **AC4 — Guia de ações recomendadas por estágio**: O arquivo `.letra/focus.md` gerado automaticamente passa a conter uma seção `"Ações Recomendadas"`, listando os comandos exatos de escrita aplicáveis ao estágio atual do item (ex: no estágio `Code`, recomendar `letra validate` e `letra ac done`; no estágio `Review`, recomendar `letra flow move`).

