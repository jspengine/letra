# Spec: workspace-settings

> Updated: 2026-07-31

## Outcome

O usuário pode acessar as configurações do workspace a qualquer momento via um botão no header. O painel permite renomear, gerenciar projetos (targets), mudar o fluxo de trabalho, configurar comandos por projeto, gerenciar adapters e excluir workspace — tudo com prévia, validação e rollback.

Um workspace é o espaço de trabalho do usuário, que pode conter um ou mais projetos rodando em um único fluxo de trabalho. O kanban representa visualmente este workflow. Futuramente, uma DSL permitirá que o usuário configure completamente seu fluxo de trabalho.

## Constraints

1. **workflow.json é a única fonte de verdade** — workspace.json vira índice leve (`id`, `name`, `slug`, `root`, `createdAt`). Toda config (tools, template, targets, stages, items) vive em workflow.json
2. Workspace continua sendo o único agregado raiz — projetos (targets) são componentes, não concorrentes
3. Um workspace = um workflow. Projetos dentro do workspace compartilham o mesmo fluxo de estágios
4. Toda alteração deve ter prévia antes de aplicar (princípio "Nothing is Magic")
5. Alterações devem ser transacionais com rollback nos últimos 30 segundos
6. O painel deve ser acessível sem perder o contexto atual (abre como Sheet lateral)
7. Operações destrutivas (excluir workspace) exigem confirmação em dois estágios
8. A UI deve seguir o design system shadcn-first, responsiva e acessível (WCAG 2.2 AA)
9. Projetos devem ser editáveis individualmente sem afetar outros projetos
10. Mudança de fluxo pode ocorrer sem perder itens existentes — itens em stages removidos vão para backlog

## Exclusions

- Sincronização de estado entre múltiplas abas/janelas do navegador
- Workspaces remotos ou compartilhados entre usuários
- Migração automática de conteúdo entre templates
- Edição de stages individuais do workflow (escopo de spec separado — futura DSL)
- Configuração de webhooks ou integrações externas
- Gerenciamento de personas ou roles do harness
- Versionamento de workflows (pode ser feito via git ou snapshots futuros)

## Acceptance Criteria

### Fundação — workflow.json como fonte única

- [ ] **AC1 — Índice leve**: workspace.json é substituído por um índice contendo apenas `id`, `name`, `slug`, `root`, `createdAt`. Campos `tools`, `template`, `directories`, `harnessVersion` são removidos de workspace.json. `GET /api/workspaces` lê o índice e enriquece com dados de workflow.json de cada workspace.
- [ ] **AC2 — Migração**: Script de migração cria índices a partir de workspaces.json legados existentes. Workspaces sem workflow.json aparecem como "Não configurado" com botão "Configurar".

### Identidade do workspace

- [ ] **AC3 — Acesso ao painel**: Um botão "Configurações" (ícone gear) aparece no header quando há workspace ativo. Ao clicar, abre um Sheet lateral direito com quatro abas: Geral, Projetos, Fluxo, Avançado. O Sheet pode ser fechado com ESC ou botão X sem salvar alterações pendentes.
- [ ] **AC4 — Edição de identidade**: Na aba Geral, o usuário pode alterar nome e descrição do workspace. Campos são validados (nome obrigatório, mínimo 2 caracteres). Alterações são salvas em workflow.json via `PATCH /api/workflow` e refletidas imediatamente no header sem recarregar a página.

### Gestão de projetos (targets)

- [ ] **AC5 — Lista de projetos**: A aba Projetos mostra todos os projetos atuais em cards, cada um exibindo: caminho relativo, tipo detectado (software/general/design/research), buildCommand, testCommand e lista de adapters instalados. Card vazio mostra "Nenhum projeto configurado" com botão "Adicionar primeiro projeto".
- [ ] **AC6 — Adicionar projeto**: Botão "Adicionar Projeto" abre um seletor de diretório reutilizando o componente de tree browser existente (`/api/fs/dirs`). Diretório selecionado é analisado automaticamente via `POST /api/workspace/setup/analyze` — detecta stack, propõe adapters. Resultado é exibido como preview antes de confirmar. Projeto é adicionado ao array `targets` em workflow.json.
- [ ] **AC7 — Editar projeto**: Ao clicar "Editar" em um projeto, abre inline editor com campos: projectType (select), buildCommand (input), testCommand (input), adapters (checkboxes). Validações: commands não podem conter caracteres perigosos (`;`, `|`, `&&`). Salva via `PATCH /api/workflow` atualizando o target específico no array `targets`.
- [ ] **AC8 — Remover projeto**: Botão "Remover" no card do projeto abre dialog de confirmação: "Remover {path}? Projetos removidos perdem seus adapters. Itens vinculados serão marcados como órfãos." Confirmação requer clique em "Confirmar remoção". Remove o target do array `targets` em workflow.json.

### Fluxo de trabalho

- [ ] **AC9 — Mudança de fluxo**: Na aba Fluxo, usuário pode selecionar novo template de uma lista (`GET /api/harness/templates`). Prévia mostra diff: stages a adicionar (verde), stages a remover (vermelho), stages inalterados (cinza). Itens em stages removidos são movidos para backlog. Mudança atualiza `template` e `stages` em workflow.json via `POST /api/workflow/template`.

- [ ] **AC10 — Gestão de adapters**: Por projeto, o usuário pode instalar ou desinstalar adapters via checkboxes. Cada adapter mostra nome, label e capacidades. Desinstalar remove o arquivo adapter do projeto mas mantém o harness canônico. Operação gera diff preview antes de executar. Adapters são atualizados no target correspondente dentro de workflow.json.

### Operações destrutivas

- [ ] **AC11 — Exclusão de workspace**: Na aba Avançado, botão "Excluir Workspace" abre dialog de dois estágios: primeiro pede confirmação ("Esta ação é irreversível"), segundo pede para digitar o nome do workspace. Exclusão remove o índice de `~/.letra/workspaces/` e `.letra-link` dos projetos, mas preserva o diretório original, workflow.json e todos os arquivos. Após excluir, redireciona para "Meus Workspaces".

### Qualidade operacional

- [ ] **AC12 — Rollback**: Toda operação de alteração (projetos, fluxo, rename) exibe toast "Alteração aplicada" com botão "Desfazer" por 30 segundos. Clique em "Desfazer" reverte a operação via `POST /api/workspace/setup/rollback` usando o manifest mais recente. Toast confirma "Alteração desfeita".

- [ ] **AC13 — Persistência**: Todas as alterações são salvas em workflow.json via `writeWorkflow()` (gateway existente). O índice em workspace.json é atualizado apenas para campos de registro (name, description). Recarregamento da página reflete todas as alterações. Não há divergência entre cliente e servidor porque há uma única fonte.

- [ ] **AC14 — Acessibilidade**: O painel passa em auditoria WCAG 2.2 AA: navegação por teclado entre abas e campos, foco visível em todos os elementos interativos, contraste mínimo 4.5:1 em textos, labels associados a todos os inputs, aria-label em botões de ícone, role="dialog" no Sheet.

## Context

### Domínio

- **Workspace**: Espaço de trabalho do usuário. Pode conter 1 ou mais projetos. Representa uma "solução em andamento".
- **Projeto (target)**: Diretório dentro do workspace que contém código ou conteúdo. Cada projeto pode ter build/test commands e adapters específicos.
- **Workflow**: Fluxo de trabalho único do workspace. Composto por stages (Backlog → Design → Code → Review → Done). O kanban representa visualmente este workflow.
- **Template**: Definição do fluxo de trabalho (quais stages existem, em que ordem). Pode ser trocado sem perder itens.

### Arquitetura atual (problema)

Hoje existem dois arquivos com campos sobrepostos sem sincronização:
- `~/.letra/workspaces/{slug}/workspace.json` — registry global com name, tools, template, directories
- `{root}/.letra/workflow.json` — estado operacional com stages, items, tools, template, targets

Mudanças em um arquivo NÃO atualizam o outro, criando drift imediato. Existem dois schemas incompatíveis de workspace.json (legado vs setup-flow).

### Arquitetura proposta (solução)

**workflow.json vira a única fonte de verdade.** workspace.json é reduzido a um índice leve para o workspace selector.

```
~/.letra/workspaces/{slug}/index.json    ← só ponteiro (id, name, slug, root, createdAt)
{root}/.letra/workflow.json              ← tudo (stages, items, tools, template, targets, specLinks)
```

### Fluxo de dados

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Índice         │     │   workflow.json   │     │   localStorage  │
│ (workspace.json) │────▶│  (fonte única)    │◀────│  (seleção)      │
│                  │     │                   │     │                 │
│ id, name, slug   │     │ stages, items,    │     │ activeWorkspace │
│ root, createdAt  │     │ tools, template,  │     │ activeDirectory │
│                  │     │ targets, specLinks│     │ theme           │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

- **Leitura**: `GET /api/workspaces` lê índice + workflow.json de cada workspace
- **Escrita**: `PATCH /api/workflow` atualiza workflow.json. Se nome mudou, índice também é atualizado
- **Seleção**: localStorage mantém qual workspace está ativo (não é config, é estado de UI)

### impactos

| Área | Mudança |
|------|---------|
| `workspace-routes.ts` | `GET /api/workspaces` lê índice + workflow.json |
| `workspace.ts` | `registerWorkspaceSetup()` cria índice + workflow.json |
| `flow-init.ts` | Cria workflow.json + índice atomicamente |
| `WorkspacesView.tsx` | Dados vêm de workflow.json via API |
| `workspace.schema.json` | Removido (obsoleto) |
| Workspaces existentes | Script de migração cria índices |
