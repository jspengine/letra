# Acceptance Criteria — workspace-settings

## AC1 — Acesso ao painel
- [ ] Botão gear aparece no header com workspace ativo
- [ ] Clique abre Sheet lateral direito
- [ ] Quatro abas visíveis: Geral, Targets, Fluxo, Avançado
- [ ] ESC fecha o Sheet sem salvar
- [ ] Botão X fecha o Sheet sem salvar
- [ ] Sheet tem role="dialog" e aria-label="Configurações do workspace"

## AC2 — Edição de identidade
- [ ] Campo nome é obrigatório e aceita mínimo 2 caracteres
- [ ] Campo descrição é opcional
- [ ] Salva com PATCH /api/workspaces/:id
- [ ] Header reflete novo nome imediatamente
- [ ] Validação aparece em tempo real

## AC3 — Lista de targets
- [ ] Cards mostram caminho, tipo, commands e adapters
- [ ] Card vazio mostra mensagem e botão de ação
- [ ] Targets são listados em ordem alfabética por path
- [ ] Tipo do target é exibido como badge

## AC4 — Adicionar target
- [ ] Botão abre seletor de diretório
- [ ] Tree browser reutiliza /api/fs/dirs
- [ ] Diretório é analisado automaticamente
- [ ] Preview mostra stack detectada e adapters propostos
- [ ] Confirmação cria target com POST /api/workspaces/:id/targets

## AC5 — Editar target
- [ ] Inline editor com campos projectType, buildCommand, testCommand
- [ ] Checkboxes para adapters
- [ ] Validação de caracteres perigosos em commands
- [ ] Salva com PATCH /api/workspaces/:id/targets/:tid

## AC6 — Remover target
- [ ] Dialog de confirmação com nome do target
- [ ] Confirmação requer dois cliques
- [ ] Remove com DELETE /api/workspaces/:id/targets/:tid

## AC7 — Mudança de template
- [ ] Lista de templates via GET /api/harness/templates
- [ ] Diff visual mostra adições, remoções e inalterados
- [ ] Itens em stages removidos vão para backlog
- [ ] Aplica com POST /api/workflow/template

## AC8 — Gestão de adapters
- [ ] Checkboxes por target
- [ ] Cada adapter mostra nome e capacidades
- [ ] Desinstalar remove arquivo adapter
- [ ] Diff preview antes de executar

## AC9 — Exclusão de workspace
- [ ] Dois estágios: confirmação + digitar nome
- [ ] Remove workspace.json e .letra-link
- [ ] Preserva diretório original
- [ ] Redireciona para Meus Workspaces

## AC10 — Rollback
- [ ] Toast "Alteração aplicada" com botão "Desfazer"
- [ ] 30 segundos de janela
- [ ] Reverte via POST /api/workspace/setup/rollback
- [ ] Confirma "Alteração desfeita"

## AC11 — Persistência
- [ ] workspace.json atualizado via API
- [ ] workflow.json atualizado quando template muda
- [ ] localStorage atualizado quando nome muda
- [ ] Reload reflete todas as alterações

## AC12 — Acessibilidade
- [ ] Navegação por teclado entre abas e campos
- [ ] Foco visível em todos os elementos
- [ ] Contraste mínimo 4.5:1
- [ ] Labels em todos os inputs
- [ ] aria-label em botões de ícone
- [ ] Passa em axe-core sem violações
