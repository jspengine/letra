# Spec: setup-flow

> Updated: 2026-06-23

## Outcome
O comando `letra setup` guiará o usuário por um wizard web interativo para configurar o workspace do zero: nome/descrição do workspace, seleção de diretórios de projetos, template de fluxo e ferramentas agênticas, com geração final de harness e prompt para IA analisar o workspace.

## Constraints
- Baseado no ADR workspace-centric-model (workspace.yaml, ~/.letra/workspace/<id>/, file picker TUI)
- Wizard roda no webapp (SPA), não em TUI
- Todas as etapas são obrigatórias — usuário não avança sem preencher
- Diretórios escaneados a partir de locais comuns: ~/code, ~/dev, ~/projects, C:/Workspace, C:/Dev
- Adapters disponíveis: cursor, claude-code, windsurf, hermes, opencode, vscode, copilot
- Template inicial único: sdlc (desenvolvimento de software)

## Exclusions
- Implementação do comando `letra workspace` CLI (já definido no ADR, fora de escopo)
- Suporte a templates não-dev (backlog em ITEM-24)
- Modo headless/CI (ADR define como flag-based, não implementado aqui)

## Acceptance Criteria

- [x] **AC1**: `letra setup` abre o webapp (ou redireciona se já estiver rodando) no wizard de setup. Se o webapp não estiver rodando, inicia `flow-serve` automaticamente e abre o browser.
- [x] **AC2**: Etapa 1 — formulário com campos "Nome do workspace" (obrigatório, validação client-side) e "Descrição" (obrigatório, mínimo 10 caracteres). Botão "Próximo" desabilitado até validação passar.
- [x] **AC3**: Etapa 2 — scanner de diretórios: UI lista diretórios encontrados em locais comuns (~/code, ~/dev, etc.) com checkbox. Input "Adicionar outro diretório" com file picker nativo. Mínimo 1 diretório selecionado para avançar.
- [x] **AC4**: Etapa 3 — seleção de template (apenas "SDLC - Desenvolvimento de Software" inicialmente) + checkboxes para ferramentas agênticas. Mínimo 1 ferramenta selecionada. Badge com contagem "X selecionadas".
- [x] **AC5**: Etapa 4 — resumo/configuração: exibe todos os dados selecionados, árvore de diretórios, template e ferramentas. Botão "Finalizar" cria workspace em `~/.letra/workspace/<slug>/` com `workspace.yaml`, gera harness nos diretórios selecionados.
- [x] **AC6**: Após finalizar, exibe prompt para o usuário copiar e colar na ferramenta agêntica escolhida: "Analise os diretórios [lista] e gere constitution.md, context.md, glossary.md e spec inicial baseado no template SDLC." Prompt deve ser específico por ferramenta.
- [x] **AC7**: Indicador visual de progresso no topo do wizard (4 etapas, passo atual destacado em amber, passos completos em verde).
- [x] **AC8**: Botão "Voltar" em cada etapa preserva estado preenchido. Fechar o wizard antes de concluir descarta o progresso (sem salvamento parcial).

## Context
Baseado no ADR workspace-centric-model.md e nos requisitos do usuário para o fluxo de configuração inicial. O wizard substitui o `letra init` existente como entry point principal. Após o setup, o usuário tem um workspace funcional com harness pronto e diretórios vinculados.
