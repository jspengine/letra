# Spec: workspace-settings

> Updated: 2026-07-31

## Outcome

O usuário pode acessar as configurações do workspace a qualquer momento via um botão no header. O painel permite renomear, gerenciar targets, mudar template, configurar comandos por target, gerenciar adapters e excluir workspace — tudo com prévia, validação e rollback. O workspace deixa de ser algo que se configura uma vez e esquece para se tornar algo que se gerencia continuamente.

## Constraints

1. Workspace continua sendo o único agregado raiz — targets são componentes, não concorrentes
2. Toda alteração deve ter prévia antes de aplicar (princípio "Nothing is Magic")
3. Alterações devem ser transacionais com rollback nos últimos 30 segundos
4. O painel deve ser acessível sem perder o contexto atual (abre como Sheet lateral)
5. Operações destrutivas (excluir workspace) exigem confirmação em dois estágios
6. A UI deve seguir o design system shadcn-first, responsiva e acessível (WCAG 2.2 AA)
7. Targets devem ser editáveis individualmente sem afetar outros targets
8. Mudança de template pode occurir sem perder itens existentes — itens em stages removidos vão para backlog
9. Alterações são sincronizadas entre workspace.json (servidor), workflow.json (harness) e localStorage (cliente)

## Exclusions

- Sincronização de estado entre múltiplas abas/janelas do navegador
- Workspaces remotos ou compartilhados entre usuários
- Migração automática de conteúdo entre templates
- Edição de stages individuais do workflow (escopo de spec separado)
- Configuração de webhooks ou integrações externas
- Gerenciamento de personas ou roles do harness

## Acceptance Criteria

- [ ] **AC1 — Acesso ao painel**: Um botão "Configurações" (ícone gear) aparece no header quando há workspace ativo. Ao clicar, abre um Sheet lateral direito com quatro abas: Geral, Targets, Fluxo, Avançado. O Sheet pode ser fechado com ESC ou botão X sem salvar alterações pendentes.
- [ ] **AC2 — Edição de identidade**: Na aba Geral, o usuário pode alterar nome e descrição do workspace. Campos são validados (nome obrigatório, mínimo 2 caracteres). Alterações são salvas com `PATCH /api/workspaces/:id` e refletidas imediatamente no header sem recarregar a página.
- [ ] **AC3 — Lista de targets**: A aba Targets mostra todos os targets atuais em cards, cada um exibindo: caminho relativo, tipo detectado (software/general/design/research), buildCommand, testCommand e lista de adapters instalados. Card vazio mostra "Nenhum target configurado" com botão "Adicionar primeiro target".
- [ ] **AC4 — Adicionar target**: Botão "Adicionar Target" abre um seletor de diretório reutilizando o componente de tree browser existente (`/api/fs/dirs`). Diretório selecionado é analisado automaticamente via `POST /api/workspace/setup/analyze` — detecta stack, propõe adapters. Resultado é exibido como preview antes de confirmar.
- [ ] **AC5 — Editar target**: Ao clicar "Editar" em um target, abre inline editor com campos: projectType (select), buildCommand (input), testCommand (input), adapters (checkboxes). Validações: commands não podem conter caracteres perigosos (`;`, `|`, `&&`). Salva com `PATCH /api/workspaces/:id/targets/:tid`.
- [ ] **AC6 — Remover target**: Botão "Remover" no card do target abre dialog de confirmação: "Remover {path}? Targets removidos perdem seus adapters. Itens vinculados serão marcados como órfãos." Confirmação requer clique em "Confirmar remoção". Salva com `DELETE /api/workspaces/:id/targets/:tid`.
- [ ] **AC7 — Mudança de template**: Na aba Fluxo, usuário pode selecionar novo template de uma lista (`GET /api/harness/templates`). Prévia mostra diff: stages a adicionar (verde), stages a remover (vermelho), stages inalterados (cinza). Itens em stages removidos são movidos para backlog. Mudança é aplicada com `POST /api/workflow/template`.
- [ ] **AC8 — Gestão de adapters**: Por target, o usuário pode instalar ou desinstalar adapters via checkboxes. Cada adapter mostra nome, label e capacidades. Desinstalar remove o arquivo adapter do target mas mantém o harness canônico. Operação gera diff preview antes de executar.
- [ ] **AC9 — Exclusão de workspace**: Na aba Avançado, botão "Excluir Workspace" abre dialog de dois estágios: primeiro pede confirmação ("Esta ação é irreversível"), segundo pede para digitar o nome do workspace. Exclusão remove `workspace.json` do registro e `.letra-link` dos targets, mas preserva o diretório original e todos os arquivos. Após excluir, redireciona para "Meus Workspaces".
- [ ] **AC10 — Rollback**: Toda operação de alteração (targets, template, rename) exibe toast "Alteração aplicada" com botão "Desfazer" por 30 segundos. Clique em "Desfazer" reverte a operação via `POST /api/workspace/setup/rollback` usando o manifest mais recente. Toast confirma "Alteração desfeita".
- [ ] **AC11 — Persistência**: Alterações no painel são sincronizadas entre: (1) `workspace.json` via API, (2) `workflow.json` quando template muda, (3) `localStorage` quando nome muda. Recarregamento da página reflete todas as alterações. State do cliente e servidor nunca divergem por mais de 1 transação.
- [ ] **AC12 — Acessibilidade**: O painel passa em auditoria WCAG 2.2 AA: navegação por teclado entre abas e campos, foco visível em todos os elementos interativos, contraste mínimo 4.5:1 em textos, labels associados a todos os inputs, aria-label em botões de ícone, role="dialog" no Sheet.

## Context

O ciclo de vida do workspace tem três atos: **criar** (workspace-smart-setup), **usar** (workspace-gate), **gerenciar** (este spec). Hoje o segundo ato existe mas o terceiro não — o usuário configura o workspace uma vez e depois só pode editar manualmente os arquivos JSON.

Este gap viola o princípio 6 da constituição: "Workspace and active scope are global context selectors, not peer destinations." Se o workspace é o contexto global do sistema, o usuário deve poder ajustá-lo sem sair do contexto nem editar arquivos.

O painel de configurações é uma extensão natural do seletor de workspace no header — não é um destino separado na navegação. Ele abre sobre o conteúdo atual, mantendo o usuário no contexto que já está visualizando.

Técnicamente, o spec consolidar as operações分散as em `workspace-routes.ts` (setup, switch, analyze, plan, rollback) em uma API CRUD completa, eliminando a necessidade de múltiplos endpointsspecializados para operações simples.
