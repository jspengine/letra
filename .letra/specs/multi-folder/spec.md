# Spec: multi-folder

> Updated: 2026-06-25

## Outcome

Usuário com workspace configurado com múltiplas pastas de destino (directories[]) consegue visualizar, alternar e operar em cada pasta individualmente pelo Web UI. O header reflete a pasta ativa, e as operações de runtime (pulse, sitrep, diagnóstico, busca) usam o contexto da pasta selecionada.

## Constraints

1. A pasta ativa é independente do workspace ativo — trocar de pasta não troca de workspace
2. A pasta ativa deve ser persistida no navegador (localStorage) para manter sessão entre recarregamentos
3. Se o workspace ativo não tem directories[] ou está vazio, o sistema opera no root do workspace (comportamento atual, sem quebra)
4. A troca de pasta ativa só é possível se o workspace estiver selecionado

## Exclusions

- Criação/edição/deleção de pastas via Web UI (usar setup flow)
- Ferramentas por diretório no setup flow (será spec separada)
- Sincronização de pasta ativa entre múltiplas abas/janelas
- Pastas remotas ou compartilhadas

## Acceptance Criteria

- [x] **AC1**: Sidebar exibe, abaixo do combobox de workspace, a lista de diretórios gerenciados do workspace ativo, com indicador visual da pasta atualmente selecionada (ícone check ou highlight)
- [x] **AC2**: Usuário pode clicar em uma pasta na sidebar para torná-la a pasta ativa — a troca persiste em localStorage e atualiza o contexto do servidor via API
- [x] **AC3**: Endpoint `POST /api/workspace/directory/switch { slug, directory }` no flow-serve que atualiza `this.activeDirectory` no servidor e faz broadcast do evento `directory-updated`
- [x] **AC4**: Header exibe o caminho relativo da pasta ativa ao lado do nome do workspace (ex: `MeuWorkspaceTeste > src/app`) quando uma pasta está selecionada; se nenhuma pasta ativa, mostra apenas o workspace
- [x] **AC5**: `GET /api/workflow` usa `this.activeDirectory` como caminho de resolução quando setado, em vez do `this.activeProjectRoot` — retorna o workflow da pasta ativa
- [x] **AC6**: Se o workspace não possui directories[] ou está vazio, a sidebar não exibe a seção de pastas e o sistema opera normalmente no root do workspace (sem quebra de compatibilidade)
- [x] **AC7**: `POST /api/workspace/switch` reseta a pasta ativa para null (trocar de workspace limpa o contexto de diretório)
- [x] **AC8**: WorkspacesView (detalhe) exibe a lista de diretórios gerenciados com indicador de qual é a pasta ativa

## Context

Hoje o setup flow permite selecionar múltiplas pastas de destino, que são persistidas em `workspace.directories[]` e geram `.letra-link` + configs de adaptador em cada uma. No entanto, o Web UI nunca utiliza essa informação — o sistema sempre opera no `workspace.root`.

O workspace-gate (ITEM-44) estabeleceu o workspace como contexto central. O multi-folder estende esse conceito: dentro de um workspace, o usuário pode alternar entre as pastas gerenciadas, e o sistema adapta seu comportamento para a pasta selecionada.

Isso é útil para:
- Monorepos com múltiplos projetos (ex: `packages/frontend`, `packages/backend`)
- Workspaces de pesquisa com múltiplos diretórios de saída
- Usuários que gerenciam vários repositórios com um harness centralizado

O `architecture-agnostic` spec já estabeleceu targets configuráveis com `target[].path` e comandos por target (AC2, AC5, AC6). Este spec integra esse conceito no Web UI.
