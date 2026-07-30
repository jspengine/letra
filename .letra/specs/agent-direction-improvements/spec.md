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

## Regression Baseline

- O detector continua comparando ACs entre specs não irmãs e mantém a severidade configurável.
- Ausência de conflitos continua produzindo um único resultado aprovado.
- Cada conflito permanece rastreável até as duas specs e os ACs envolvidos.
- O agrupamento altera somente a apresentação e a contagem de avisos; o algoritmo de detecção não é modificado.

## Acceptance Criteria

- [x] **AC1 — Agregação de conflitos**: O validador de conflito (`validate-conflict`) agrupa avisos redundantes ou repetidos de uma mesma especificação, reduzindo o número total de alertas de aviso individuais exibidos ao usuário e agente.
- [x] **AC2 — Hiperlinks no CLI (Adaptadores)**: Outputs gerados pelo CLI para arquivos markdown (como `AGENTS.md` e `.letra/focus.md`) incluem links clicáveis padrão markdown no esquema `file:///` para as especificações, itens e regras citados.
- [x] **AC3 — Links de arquivos no terminal**: O comando `letra pulse` e `letra status` exibe arquivos com formato URL `file:///` nas saídas do console para facilitar o acesso rápido por IDEs/Agentes compatíveis.
- [x] **AC4 — Guia de ações recomendadas por estágio**: O arquivo `.letra/focus.md` gerado automaticamente passa a conter uma seção `"Ações Recomendadas"`, listando os comandos exatos de escrita aplicáveis ao estágio atual do item (ex: no estágio `Code`, recomendar `letra validate` e `letra ac done`; no estágio `Review`, recomendar `letra flow move`).

## Context

Para que o par de desenvolvimento baseado em LLM ofereça o máximo de eficiência, a comunicação fornecida pelo framework Letra nas instruções de contexto e ferramentas deve ser otimizada. A redução do ruído nas validações e a inclusão de links diretos de arquivos reduzem os passos necessários para que o agente analise e edite a base de código.

## Regression Evidence

A evidência de cada AC deve registrar testes direcionados, suíte afetada, typecheck, `letra validate` e riscos residuais conhecidos.

- **AC1**: 20 testes direcionados e da suíte do validador aprovados; typecheck e bundle do CLI aprovados. No workspace real, 194 ocorrências foram consolidadas em 95 avisos por par de specs, reduzindo o total da validação de 628 para 529 avisos, com 2 aprovações e 0 falhas. O algoritmo de detecção e a severidade configurável permaneceram inalterados. Risco residual: pares distintos continuam separados intencionalmente para preservar a origem do conflito.
- **AC2**: 89 testes da suíte afetada aprovados; typecheck, bundle do CLI e `letra validate` aprovados com 2 aprovações e 0 falhas. `focus.md`, `AGENTS.md` e o adaptador OpenCode foram regenerados com links absolutos `file:///` para spec, item, contexto e regras, preservando os campos legados e o formato `@` das ferramentas compatíveis. Risco residual: o link de item abre o `workflow.json`, pois o formato JSON não oferece uma âncora portável para um item específico; a abertura de `file:///` também depende da política de segurança do editor.
- **AC3**: 16 testes direcionados e da suíte afetada aprovados; typecheck, bundle do CLI e `letra validate` aprovados com 2 aprovações e 0 falhas. Execução real confirmou URLs `file:///` para workflow e spec em `letra pulse`, e para `workspace.json` em `letra status`; a saída de `pulse --json` permaneceu inalterada. Risco residual: reconhecimento e abertura automática de URLs locais dependem do terminal e da política do editor.
- **AC4**: 117 testes direcionados e da suíte afetada aprovados; typecheck, bundle do CLI e `letra validate` aprovados com 2 aprovações e 0 falhas. O harness v0.1.3 passou a declarar `commands` por atividade, e o `focus.md` real do ITEM-60 foi regenerado em `Code` com `letra ac done <AC-ID>` e `letra validate`. `nextActions` narrativas permanecem separadas dos comandos executáveis, e nenhum comando é executado automaticamente. Risco residual: flows ou estágios sem `commands` declarados não exibem recomendações, por desenho, para impedir orientação inventada pelo CLI.
