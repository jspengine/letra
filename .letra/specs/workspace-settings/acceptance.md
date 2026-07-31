# Acceptance Criteria — workspace-settings

## AC1 — Índice leve
- [ ] workspace.json contém apenas: id, name, slug, root, createdAt
- [ ] Campos tools, template, directories, harnessVersion removidos de workspace.json
- [ ] `GET /api/workspaces` lê índice e enriquece com workflow.json

## AC2 — Migração
- [ ] Script detecta workspaces.json legados
- [ ] Cria índice a partir dos dados legados
- [ ] Workspaces sem workflow.json aparecem como "Não configurado"
- [ ] Botão "Configurar" abre o setup wizard

## AC3 — Acesso ao painel
- [ ] Botão gear aparece no header com workspace ativo
- [ ] Clique abre Sheet lateral direito
- [ ] Quatro abas visíveis: Geral, Locais, Fluxo, Avançado
- [ ] ESC fecha o Sheet sem salvar
- [ ] Botão X fecha o Sheet sem salvar
- [ ] Sheet tem role="dialog" e aria-label="Configurações do workspace"

## AC4 — Edição de identidade
- [ ] Campo nome é obrigatório e aceita mínimo 2 caracteres
- [ ] Campo descrição é opcional
- [ ] Salva em workflow.json via PATCH /api/workflow
- [ ] Índice é atualizado se nome mudou
- [ ] Header reflete novo nome imediatamente
- [ ] Validação aparece em tempo real

## AC5 — Lista de locais
- [ ] Cards mostram caminho e label
- [ ] Card vazio mostra mensagem e botão de ação
- [ ] Locais são listados em ordem alfabética por path

## AC6 — Adicionar local
- [ ] Botão abre seletor de diretório
- [ ] Tree browser reutiliza /api/fs/dirs
- [ ] Preview mostra caminho completo
- [ ] Confirmação adiciona location ao array locations em workflow.json

## AC7 — Editar local
- [ ] Inline editor com campo label
- [ ] Salva via PATCH /api/workflow atualizando location específico

## AC8 — Remover local
- [ ] Dialog de confirmação com nome do local
- [ ] Confirmação requer dois cliques
- [ ] Remove location do array locations em workflow.json

## AC9 — Mudança de fluxo
- [ ] Lista de templates via GET /api/harness/templates
- [ ] Diff visual mostra adições, remoções e inalterados
- [ ] Itens em stages removidos vão para backlog
- [ ] Atualiza template e stages em workflow.json

## AC10 — Gestão de adapters
- [ ] Checkboxes para adapters (tools do workspace)
- [ ] Cada adapter mostra nome e label
- [ ] Desinstalar remove arquivo adapter
- [ ] Diff preview antes de executar
- [ ] Atualiza campo tools em workflow.json

## AC11 — Exclusão de workspace
- [ ] Dois estágios: confirmação + digitar nome
- [ ] Remove índice de ~/.letra/workspaces/
- [ ] Remove .letra-link dos locais
- [ ] Preserva diretório original e workflow.json
- [ ] Redireciona para Meus Workspaces

## AC12 — Rollback
- [ ] Toast "Alteração aplicada" com botão "Desfazer"
- [ ] 30 segundos de janela
- [ ] Reverte via POST /api/workspace/setup/rollback
- [ ] Confirma "Alteração desfeita"

## AC13 — Persistência
- [ ] Todas as alterações em workflow.json via writeWorkflow()
- [ ] Índice atualizado apenas para name/description
- [ ] Reload reflete todas as alterações
- [ ] Sem divergência cliente/servidor (única fonte)

## AC14 — Acessibilidade
- [ ] Navegação por teclado entre abas e campos
- [ ] Foco visível em todos os elementos
- [ ] Contraste mínimo 4.5:1
- [ ] Labels em todos os inputs
- [ ] aria-label em botões de ícone
- [ ] Passa em axe-core sem violações
