# Spec: workspace-settings

> Updated: 2026-07-31

## Outcome

O usuário pode acessar as configurações do workspace a qualquer momento via um botão no header. O painel permite renomear, gerenciar locais de mudança, mudar o fluxo de trabalho, gerenciar adapters e excluir workspace — tudo com prévia, validação e rollback.

Um workspace é o espaço de trabalho do usuário que representa uma **solução em andamento**. Esta solução pode ser transversal — tocando múltiplos repositórios e pastas locais. O kanban representa visualmente o fluxo de trabalho da solução. Build e test são responsabilidade de ferramentas externas (CI/CD), não do Letra.

## Constraints

1. **workflow.json é a única fonte de verdade** — workspace.json vira índice leve (`id`, `name`, `slug`, `root`, `createdAt`). Toda config (tools, template, locations, stages, items) vive em workflow.json
2. Workspace continua sendo o único agregado raiz — locais de mudança são componentes, não concorrentes
3. Um workspace = um workflow. Locais compartilham o mesmo fluxo de estágios
4. **Letra não gerencia build/test** — isso é responsabilidade de CI/CD. Letra é sobre governança, harness e fluxo de trabalho agentico
5. Toda alteração deve ter prévia antes de aplicar (princípio "Nothing is Magic")
6. Alterações devem ser transacionais com rollback nos últimos 30 segundos
7. O painel deve ser acessível sem perder o contexto atual (abre como Sheet lateral)
8. Operações destrutivas (excluir workspace) exigem confirmação em dois estágios
9. A UI deve seguir o design system shadcn-first, responsiva e acessível (WCAG 2.2 AA)
10. Locais devem ser editáveis individualmente sem afetar outros locais
11. Mudança de fluxo pode ocorrer sem perder itens existentes — itens em stages removidos vão para backlog

## Exclusions

- **Build e test** — não são responsabilidade do Letra. Existe CI/CD para isso.
- Comandos de build, test ou qualquer execução de código por projeto
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

- [ ] **AC3 — Acesso ao painel**: Um botão "Configurações" (ícone gear) aparece no header quando há workspace ativo. Ao clicar, abre um Sheet lateral direito com quatro abas: Geral, Locais, Fluxo, Avançado. O Sheet pode ser fechado com ESC ou botão X sem salvar alterações pendentes.
- [ ] **AC4 — Edição de identidade**: Na aba Geral, o usuário pode alterar nome e descrição do workspace. Campos são validados (nome obrigatório, mínimo 2 caracteres). Alterações são salvas em workflow.json via `PATCH /api/workflow` e refletidas imediatamente no header sem recarregar a página.

### Gestão de locais de mudança

- [ ] **AC5 — Lista de locais**: A aba Locais mostra todos os locais atuais em cards, cada um exibindo: caminho relativo e label. Card vazio mostra "Nenhum local configurado" com botão "Adicionar primeiro local".
- [ ] **AC6 — Adicionar local**: Botão "Adicionar Local" abre um seletor de diretório reutilizando o componente de tree browser existente (`/api/fs/dirs`). Diretório selecionado aparece como preview com caminho completo antes de confirmar. Local é adicionado ao array `locations` em workflow.json.
- [ ] **AC7 — Editar local**: Ao clicar "Editar" em um local, abre inline editor com campo label (input). Salva via `PATCH /api/workflow` atualizando o local específico no array `locations`.
- [ ] **AC8 — Remover local**: Botão "Remover" no card do local abre dialog de confirmação: "Remover {path}?" Confirmação requer clique em "Confirmar remoção". Remove o local do array `locations` em workflow.json.

### Fluxo de trabalho

- [ ] **AC9 — Mudança de fluxo**: Na aba Fluxo, usuário pode selecionar novo template de uma lista (`GET /api/harness/templates`). Prévia mostra diff: stages a adicionar (verde), stages a remover (vermelho), stages inalterados (cinza). Itens em stages removidos são movidos para backlog. Mudança atualiza `template` e `stages` em workflow.json via `POST /api/workflow/template`.

- [ ] **AC10 — Gestão de adapters**: O usuário pode instalar ou desinstalar adapters via checkboxes. Cada adapter mostra nome e label. Desinstalar remove o arquivo adapter mas mantém o harness canônico. Operação gera diff preview antes de executar. Adapters são atualizados no campo `tools` dentro de workflow.json.

### Operações destrutivas

- [ ] **AC11 — Exclusão de workspace**: Na aba Avançado, botão "Excluir Workspace" abre dialog de dois estágios: primeiro pede confirmação ("Esta ação é irreversível"), segundo pede para digitar o nome do workspace. Exclusão remove o índice de `~/.letra/workspaces/` e `.letra-link` dos locais, mas preserva o diretório original, workflow.json e todos os arquivos. Após excluir, redireciona para "Meus Workspaces".

### Qualidade operacional

- [ ] **AC12 — Rollback**: Toda operação de alteração (locais, fluxo, rename) exibe toast "Alteração aplicada" com botão "Desfazer" por 30 segundos. Clique em "Desfazer" reverte a operação via `POST /api/workspace/setup/rollback` usando o manifest mais recente. Toast confirma "Alteração desfeita".

- [ ] **AC13 — Persistência**: Todas as alterações são salvas em workflow.json via `writeWorkflow()` (gateway existente). O índice em workspace.json é atualizado apenas para campos de registro (name, description). Recarregamento da página reflete todas as alterações. Não há divergência entre cliente e servidor porque há uma única fonte.

- [ ] **AC14 — Acessibilidade**: O painel passa em auditoria WCAG 2.2 AA: navegação por teclado entre abas e campos, foco visível em todos os elementos interativos, contraste mínimo 4.5:1 em textos, labels associados a todos os inputs, aria-label em botões de ícone, role="dialog" no Sheet.

## Context

### Domínio

- **Workspace**: Espaço de trabalho do usuário que representa uma **solução em andamento**. Pode ser transversal — tocando múltiplos repositórios e pastas locais.
- **Local de mudança**: Diretório onde a solução faz alterações. Não tem comandos de build/test — isso é responsabilidade de CI/CD externo.
- **Workflow**: Fluxo de trabalho único da solução. Composto por stages (Backlog → Design → Code → Review → Done). O kanban representa visualmente este workflow.
- **Template**: Definição do fluxo de trabalho (quais stages existem, em que ordem). Pode ser trocado sem perder itens.
- **Adapter**: Tradutor que converte `.letra/` para o formato que uma IDE/agent entende. Adaptador é do workspace, não do local.

### Responsabilidades do Letra

| Letra FAZ | Letra NÃO FAZ |
|-----------|---------------|
| Governança de workflow | Build de código |
| Gestão de harness | Testes automatizados |
| Fluxo de trabalho agentico | CI/CD |
| Supervisão e auditoria | Deploy |
| Configuração de adapters | Execução de comandos |

### Arquitetura proposta

**workflow.json vira a única fonte de verdade.** workspace.json é reduzido a um índice leve.

```
~/.letra/workspaces/{slug}/index.json    ← só ponteiro (id, name, slug, root, createdAt)
{root}/.letra/workflow.json              ← tudo (stages, items, tools, template, locations, specLinks)
```

### Schema de locations (simplificado)

```typescript
interface WorkflowLocation {
  id: string;        // ex: "loc-abc123"
  path: string;      // ex: "frontend/" ou "/abs/path/to/repo"
  label: string;     // ex: "Login UI" ou "Auth API"
}
```

Sem buildCommand. Sem testCommand. Sem projectType. Sem adapters por local.
