# Spec: Melhorias no Direcionamento de Agentes

> Updated: 2026-07-02

## Outcome

Agentes de inteligência artificial (como Antigravity) operam com maior foco e menor ruído cognitivo no workspace. Os avisos de conflito de especificações são agregados e legíveis, os comandos do CLI fornecem caminhos de arquivos clicáveis no formato padrão markdown, e as instruções do adaptador guiam dinamicamente o agente com base nas ações recomendadas para o estágio do item ativo.

## Constraints

- O CLI deve continuar compatível com terminais tradicionais (ignorar formatação markdown rica onde não for apropriado ou usar somente para outputs destinados aos adaptadores/arquivos markdown).
- Nenhuma modificação nos arquivos de auditoria canônicos ou perda de logs de validação deve ocorrer.
- A autoridade do Harness sobre as regras de validação deve ser preservada.

## Exclusions

- Otimização de performance de renderização do TUI.
- Alteração no algoritmo central de validação sintática das especificações.

## Acceptance Criteria

- [ ] **AC1 — Agregação de conflitos**: O validador de conflito (`validate-conflict`) agrupa avisos redundantes ou repetidos de uma mesma especificação, reduzindo o número total de alertas de aviso individuais exibidos ao usuário e agente.
- [ ] **AC2 — Hiperlinks no CLI (Adaptadores)**: Outputs gerados pelo CLI para arquivos markdown (como `AGENTS.md` e `.letra/focus.md`) incluem links clicáveis padrão markdown no esquema `file:///` para as especificações, itens e regras citados.
- [ ] **AC3 — Links de arquivos no terminal**: O comando `letra pulse` e `letra status` exibe arquivos com formato URL `file:///` nas saídas do console para facilitar o acesso rápido por IDEs/Agentes compatíveis.
- [ ] **AC4 — Guia de ações recomendadas por estágio**: O arquivo `.letra/focus.md` gerado automaticamente passa a conter uma seção `"Ações Recomendadas"`, listando os comandos exatos de escrita aplicáveis ao estágio atual do item (ex: no estágio `Code`, recomendar `letra validate` e `letra ac done`; no estágio `Review`, recomendar `letra flow move`).

## Context

Para que o par de desenvolvimento baseado em LLM ofereça o máximo de eficiência, a comunicação fornecida pelo framework Letra nas instruções de contexto e ferramentas deve ser otimizada. A redução do ruído nas validações e a inclusão de links diretos de arquivos reduzem os passos necessários para que o agente analise e edite a base de código.

