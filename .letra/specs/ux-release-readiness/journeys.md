# UX Journeys — Release Readiness

> Updated: 2026-07-10

## Journey Map

## 1. Workspace

### Purpose

Entrar no produto, selecionar ou criar o workspace e estabelecer o contexto global de supervisão.

### Existing Surface

- `WorkspacesView`
- `WorkspaceSetupFlow`

### Release Intent

Esta jornada continua existindo, mas como porta de entrada e contexto, não como destino concorrente da navegação principal quando o workspace já está ativo.

### Success Signal

O usuário entra no workspace certo e entende imediatamente qual contexto está supervisionando.

## 2. Supervisão

### Purpose

Entender o que exige atenção agora, decidir com segurança e abrir a evidência certa.

### Existing Surface

- `HomeView`
- `SupervisionInbox`
- partes do `Header`

### Release Intent

`Supervisão` vira a entrada padrão. O produto deve priorizar:

- decisões pendentes
- bloqueios e falhas
- próxima ação segura
- atividade recente
- saúde operacional

### Success Signal

O usuário consegue identificar em poucos segundos:

- o que depende dele
- qual é a próxima ação segura
- onde abrir a evidência correspondente

## 3. Trabalho

### Purpose

Supervisionar o fluxo de trabalho dos itens e agir no contexto do board e do item.

### Existing Surface

- `FlowView`
- `KanbanBoard`
- `ItemDetailModal`
- `ActivityTimeline`

### Release Intent

`Trabalho` deve focar em:

- board canônico
- item atual
- gates no contexto do item
- progresso e estados do fluxo

Deve sair do primeiro plano tudo que for administração estrutural de workflow, como edição de stages e webhooks, salvo se explicitamente rebaixado para modo avançado.

### Success Signal

O usuário encontra rapidamente o item relevante, entende seu estado e consegue agir sem ruído administrativo.

## 4. Conhecimento e Regras

### Purpose

Consultar e editar a verdade documental e normativa que governa o workspace.

### Existing Surface

- `ContextView`
- `SpecsView`
- `HarnessViewer`
- `DocumentEditor`

### Release Intent

Unificar:

- contexto
- constitution
- glossary
- decisions
- specs
- harness

como uma área de governança e entendimento, não como coleção de arquivos avulsos.

### Success Signal

O usuário encontra a regra ou a spec certa sem precisar conhecer a estrutura interna do repositório.

## 5. Atividade

### Purpose

Investigar o que aconteceu, por quem, quando, por quê e com qual evidência.

### Existing Surface

- `AuditLogView`
- elementos de timeline
- sinais operacionais parciais

### Release Intent

`Atividade` deve ser a trilha investigativa oficial do produto, com ênfase em:

- eventos humanos
- automações supervisionáveis
- filtros úteis
- links para item/spec/decisão

### Success Signal

O usuário consegue reconstruir um fato operacional importante sem sair em busca manual de contexto.

## Surfaces To Reposition

## Agents / Roles

Não devem competir como destino primário na release. O conteúdo pode permanecer, mas como aprofundamento contextual.

## Execution

Tem valor, mas hoje está mais alinhado a visualização técnica do fluxo do que à navegação principal por intenção. Deve ser incorporado a `Trabalho` ou rebaixado.

## Diagnostics

Precisa permanecer acessível, porém integrado à supervisão e à saúde do workspace, em vez de existir apenas como affordance periférica de header.

## Release Narrative

Para a release, o Letra deve se apresentar assim:

1. Escolha o workspace.
2. Veja o que exige sua atenção em `Supervisão`.
3. Entre em `Trabalho` para atuar sobre itens e gates.
4. Consulte `Conhecimento e Regras` para entender contexto e governança.
5. Use `Atividade` para investigar evidências e histórico.
