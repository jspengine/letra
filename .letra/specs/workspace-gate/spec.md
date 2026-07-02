# Spec: workspace-gate

> Updated: 2026-06-24

## Outcome

Ao carregar o Letra Web UI, o usuário é recebido pela tela "Meus Workspaces" como primeira experiência. Sem um workspace selecionado, todas as demais funcionalidades do sistema ficam bloqueadas — o sistema não sabe em que contexto trabalhar. Após selecionar ou criar um workspace, o nome e descrição do workspace passam a ser exibidos no Header, e todas as telas passam a referenciar o workspace ativo.

## Constraints

1. O workspace ativo deve ser persistido no navegador (localStorage) para manter a sessão entre recarregamentos
2. A troca de workspace deve ser possível a qualquer momento via sidebar
3. O header deve exibir nome e descrição do workspace ativo, substituindo o texto fixo atual ("Letra")
4. Sem workspace ativo, a sidebar deve mostrar apenas a tab "Meus Workspaces" e desabilitar visualmente as demais
5. A API `/api/workspaces` já lista workspaces registrados — usar este endpoint como fonte

## Exclusions

- Edição de workspace (renomear, alterar descrição)
- Deleção de workspace
- Sincronização de workspace ativo entre múltiplas abas/janelas
- Suporte a workspaces remotos ou compartilhados

## Acceptance Criteria

- [x] **AC1**: Ao carregar a aplicação sem workspace ativo no localStorage, a tab inicial é "Meus Workspaces" e as demais tabs da sidebar estão visualmente bloqueadas/desabilitadas com tooltip "Selecione um workspace primeiro"
- [x] **AC2**: Sem workspace ativo, as rotas/views que não sejam "Meus Workspaces" exibem uma mensagem "Selecione ou crie um workspace para começar" em vez do conteúdo normal
- [x] **AC3**: O Header exibe `{workspace.name}` e `{workspace.description}` quando um workspace está ativo, substituindo o "Letra" fixo
- [x] **AC4**: WorkspacesView (Meus Workspaces) permite selecionar um workspace existente clicando no card — ao selecionar, salva no localStorage como `letra-active-workspace`, libera as demais telas e redireciona para Dashboard
- [x] **AC5**: WorkspacesView permite criar workspace via WorkspaceSetupFlow — ao concluir, o novo workspace é automaticamente selecionado como ativo
- [x] **AC6**: O estado `activeWorkspace` é gerenciado no App.tsx (ou contexto) e passado como prop para Header, Sidebar e demais views que precisam referenciá-lo
- [x] **AC7**: Sidebar destaca visualmente o workspace ativo quando na tab "Meus Workspaces" (badge "ativo" ou check)
- [x] **AC8**: refreshWorkflow e demais chamadas de API usam o `activeWorkspace.root` para resolver caminhos corretos

## Context

Atualmente o Letra Web UI inicia na tab "Dashboard" e exibe "Letra" no Header. Não há conceito de "workspace ativo" — o sistema assume o workflow carregado pelo flow-serve. Com a adição do sistema de workspaces multi-repo, o usuário precisa explicitamente escolher em qual contexto está trabalhando.

Este spec implementa o workspace como "portão de entrada" (gate) da aplicação: sem workspace, nada funciona. O workspace ativo vira o centro do sistema, guiando todas as operações.
