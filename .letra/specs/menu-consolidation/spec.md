# Spec: Consolidação e Redesenho de Menus

> Updated: 2026-07-03

## Outcome

A Web UI do Letra apresenta um menu lateral limpo, coerente com os princípios constitucionais (supervisão de agentes, workspace como contexto e harness como autoridade), livre de caminhos redundantes e sem recursos desabilitados ou inativos que causem atrito de comunicação para o usuário supervisor.

## Constraints

- Todos os componentes interativos de navegação devem usar o framework de UI oficial (`@letra/ui` ou shadcn/ui).
- As etapas de execução exibidas no menu lateral devem ser dinâmicas e baseadas na definição ativa do flow no harness, em vez de rotas estáticas e hardcoded.
- Os logs de auditoria canônicos e append-only devem ser preservados sem alteração.
- Configurações do workspace permanecem sob autoridade do arquivo `.letra/config.json`.

## Exclusions

- Redesenho completo do sistema de design visual (paleta de cores, tipografia principal).
- Integração de ferramentas externas de observabilidade SaaS.
- Implementação de um fluxo de pull requests na própria Web UI.

## Acceptance Criteria

- [x] **AC1 — Remoção de itens inativos**: As abas desabilitadas na barra lateral (`Pull Requests`, `Monitoramento`, `Configurações`) são removidas/ocultadas da navegação principal.
- [x] **AC2 — Unificação de estágios estáticos**: As abas estáticas e redundantes `Discovery` e `Design` são unificadas sob um único menu **"Pipeline"**.
- [x] **AC3 — Menu dinâmico de pipeline**: O novo menu "Pipeline" exibe os estágios de forma dinâmica com base no harness ativo configurado no workspace, respeitando a autoridade de domínio.
- [x] **AC4 — Inspeção do Harness**: O menu **"Harness"** é habilitado em modo leitura (*read-only*), permitindo ao usuário inspecionar as regras fundamentais, personas e templates do workspace carregados na sessão.
- [x] **AC5 — Alinhamento de Terminologias**: O menu **"Conhecimento"** é renomeado para **"Contexto"** na barra lateral, harmonizando com o título interno da página ("Context").
- [x] **AC6 — Rastreabilidade contextual na Auditoria**: As entradas da linha do tempo na Auditoria contêm links clicáveis direcionando para o item (`ITEM-X`) ou especificação correspondente quando estes existirem no workspace.
- [x] **AC7 — Auditoria por Papel**: O filtro de ações/atores na Auditoria permite selecionar especificamente as personas configuradas no harness ativo (ex: `analyst`, `security`, `reviewer`).

## Context

A estrutura atual de menus apresenta caminhos redundantes que confundem o usuário supervisor e itens desabilitados que geram percepção de produto incompleto. Para alinhar a interface com o foco do Letra (supervisão de agentes autônomos de desenvolvimento), o menu deve ser simplificado, dinâmico com base no Harness e possuir terminologia uniforme.

