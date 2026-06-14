# Letra

> **Sua spec é a fonte da verdade.**

Letra é um framework de **Specification-Driven Development (SDD) agnóstico a ferramentas**. Captura direção, intenção e contexto, enriquecendo prompts de agentes de código — funcionando como uma **memória persistente** do projeto.

Inclui CLI, SPA web UI e adapters para Cursor, Claude Code, Windsurf, VS Code e OpenCode.

## O Problema

- **Spec-Code Drift**: Especificações ficam desatualizadas conforme o código evolui.
- **Markdown Madness**: Specs de 50k+ tokens que ninguém lê.
- **Perda de Contexto**: Decisões vivem só no histórico do chat.
- **Tool Lock-in**: Ferramentas presas a um IDE ou modelo específico.
- **Workflow Invisível**: Não dá pra ver o que está em progresso, o que já foi feito.

## A Solução

- **Thin Specs**: Máximo 1 página por feature.
- **Spec-Anchored**: Spec vive junto com o código, atualizada como parte do DoD.
- **Context First**: Intent, constraints e "porquês" — não markdown verbose.
- **Workflow Engine**: Board visual, backlog, movimentação entre estágios.
- **Web UI**: Interface gráfica para não-devs gerenciarem specs e workflow.
- **Agnóstico**: Adapters para OpenCode, Cursor, VS Code, Claude Code, Windsurf.

## Quick Start

```bash
# Inicializar projeto
npx @letra-ai/cli init meu-projeto

# Criar uma spec
npx @letra-ai/cli spec minha-feature

# Validar
npx @letra-ai/cli validate
```

## CLI Commands

### `letra init`

Inicializa a estrutura `.letra/` no projeto.

```bash
letra init                  # Modo interativo (pergunta tipo de projeto + ferramenta)
letra init --yes            # Usa defaults, sem perguntas
letra init --serve          # Inicializa e abre web UI
```

Cria: `context.md`, `constitution.md`, `glossary.md`, `lessons-learned.md`, `config.json`, adapters, estrutura `specs/`, `decisions/`.

### `letra spec`

```bash
letra spec new <nome>                       # Criar spec com template default
letra spec new <nome> --template web-api    # Template REST/GraphQL
letra spec new <nome> --template cli-tool   # Template CLI
letra spec new <nome> --template mobile-feature  # Template mobile
```

Templates custom: coloque arquivos `.md` em `.letra/templates/`.

### `letra lint`

Valida formato e completude das specs (seções obrigatórias, tamanho, checklist).

```bash
letra lint
```

### `letra validate`

Verifica acceptance criteria com 8 heurísticas configuráveis.

```bash
letra validate                                          # Terminal colorido
letra validate --format github-annotation               # GitHub Actions annotations
letra validate --format junit                            # XML para CI tools
letra validate --watch                                   # Re-valida ao salvar
letra validate --watch --format github-annotation        # Combinar flags
```

### `letra decision`

Architecture Decision Records (ADRs).

```bash
letra decision new "Usar Commander em vez de Yargs"
letra decision list
```

ADRs salvos em `.letra/decisions/{slug}.md` com template Contexto → Decisão → Consequências.

### `letra focus`

Define o foco da sessão atual para guiar o agente de IA.

```bash
letra focus validate-conflict      # Define foco em uma spec
letra focus                         # Ver foco atual
letra focus --clear                 # Limpar foco
```

Cria `.letra/focus.md` com o Outcome da spec referenciada.

### `letra flow`

Workflow engine completo.

```bash
# Inicializar workflow
letra flow init --quick             # Setup com 3 perguntas
letra flow init                     # Setup interativo completo

# Gerenciar backlog
letra flow backlog add "Implementar login"
letra flow backlog list
letra flow backlog import github owner/repo --label bug --limit 20
letra flow backlog import linear MYTEAM --limit 50

# Mover itens entre estágios
letra flow move ITEM-1 --to Code
letra flow move "Implementar login" --to Review

# Visualizar
letra flow board                     # Board no terminal
letra flow visualize                  # Diagrama Mermaid
letra flow visualize --output diagram.html

# Editar metadados
letra flow edit --name "Novo Nome" --desc "Descrição"
letra flow diff                      # Diff com último backup
letra flow diff v1 v2                # Diff entre versões

# Exportar/Importar
letra flow export                     # JSON pretty
letra flow export --minified          # JSON minificado
letra flow import workflow.json

# Servidor web + API
letra flow serve                      # http://localhost:3000
letra flow serve --port 8080 --open
```

## Web UI

Acesse via `letra init --serve` ou `letra flow serve` — abre em `http://localhost:3000`.

### Home
- Métricas: specs válidas, drift, foco atual, stale items
- Pipeline mini-kanban com drag-and-drop
- Specs recentes com progresso de ACs
- Decisões recentes
- Detecção de bottlenecks

### Specs
- CRUD visual de specs com busca e filtros (all/errors/warnings/valid)
- Editor Markdown inline com AC checklist toggle
- Validação on-demand

### Flow
- Kanban board com drag-and-drop
- Detail panel: header, tasks, spec rendering
- Stage management: zonas, cores, transições, validações
- Gerenciamento de webhooks

### Context
- Visualização de context.md, constitution.md, glossary.md
- Decision browser com formatação

## Validação

8 heurísticas configuráveis via `.letra/config.json`:

| Heurística | O que detecta | Severidade |
|---|---|---|
| **Seções Vazias** | Placeholder text nas seções obrigatórias | warning |
| **Conteúdo Mínimo** | Outcome muito curto (<50 chars) | warning |
| **ACs sem Métrica** | Critérios vagos sem métrica | warning |
| **Consistência Terminologia** | Termos fora do glossário | warning |
| **Detecção de Tom** | Gírias e informalidade | warning |
| **Baixa Confiança** | "provavelmente", "talvez" | warning |
| **Drift Temporal** | Specs desatualizadas (>30d) | warning |
| **Conflito entre Specs** | ACs contraditórios (MECE) | warning |

## Adapters

| Ferramenta | Artefato | Regeneração |
|---|---|---|
| Cursor | `.cursorrules` | `flow move` |
| Claude Code | `CLAUDE.md` | `flow move` |
| Windsurf | `.windsurfrules` | `flow move` |
| VS Code Copilot | `.github/copilot-instructions.md` | `flow move` |
| OpenCode | `AGENTS.md` | `flow move` |

## REST API (flow serve)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/workflow` | Obter workflow |
| PATCH | `/api/workflow` | Atualizar workflow |
| POST | `/api/workflow/template` | Criar de template (padrão/kanban/ágil/custom) |
| GET | `/api/specs` | Listar specs |
| POST | `/api/specs` | Criar spec |
| PUT | `/api/specs/:id` | Atualizar spec |
| DELETE | `/api/specs/:id` | Deletar spec |
| POST | `/api/specs/:id/validate` | Validar spec |
| POST | `/api/items` | Criar item |
| PATCH | `/api/items/:id` | Atualizar item |
| DELETE | `/api/items/:id` | Deletar item |
| GET | `/api/focus` | Obter foco |
| GET | `/api/context?file=` | Obter arquivo de contexto |
| GET | `/events` | SSE live updates |

## Design System

18 componentes React com dark/light mode e zero runtime dependencies:

- **Button** — default/secondary/outline/ghost, sm/lg
- **Badge** — default/secondary/outline/success/warning
- **Card** — Card, CardContent, CardHeader, CardTitle
- **Icon** — 28 SVG icons (home, specs, flow, context, etc.)
- **Dialog** — Dialog, ConfirmDialog (danger variant), PromptDialog
- **Checkbox, Input, Textarea, Skeleton, Tabs, Progress, Alert, Tooltip, Avatar, Toast, EmptyState**
- **cn()** — classnames utility

Tokens CSS em OKLCH (~70 variáveis): surface, text, border, brand, semânticos.

## Config System

`.letra/config.json` com heurísticas ajustáveis por projeto:

```json
{
  "heuristics": {
    "conteudo-minimo": { "severity": "warning", "minChars": 50 },
    "drift-temporal": { "severity": "error", "maxDays": 14 },
    "detecao-tom": { "severity": "off" }
  }
}
```

## Data Resilience

- Backup automático: `.letra/backups/workflow-{timestamp}.json`
- Versionamento: `workflow.v{version}.json` a cada `flow edit`
- Merge preserva dados existentes em re-setup

## Estrutura de Memória

```
.letra/
├── context.md              # Intent global, domínio, restrições
├── constitution.md          # Regras não-negociáveis
├── glossary.md              # Termos do domínio
├── lessons-learned.md       # Erros recorrentes
├── config.json              # Heurísticas configuráveis
├── workflow.json            # Workflow (estágios, items, specs)
├── focus.md                 # Foco da sessão atual
├── decisions/               # ADRs
│   └── usar-commander.md
├── specs/
│   └── minha-feature/
│       ├── spec.md          # Spec (1 página max)
│       └── acceptance.md    # Critérios binários
├── templates/               # Templates custom de spec
├── adapters/                # Configuração de adapters
└── backups/                 # Backups automáticos
```

## Exemplo Completo

```bash
# Criar projeto
mkdir meu-app && cd meu-app
npx @letra-ai/cli init --yes

# Criar spec
npx @letra-ai/cli spec auth --template web-api

# Editar .letra/specs/auth/spec.md com sua intenção
# Desenvolver...

# Validar
npx @letra-ai/cli validate

# Gerenciar workflow
npx @letra-ai/cli flow init --quick
npx @letra-ai/cli flow backlog add "Tela de login"
npx @letra-ai/cli flow move ITEM-1 --to Code
npx @letra-ai/cli flow move ITEM-1 --to Review
npx @letra-ai/cli flow board
npx @letra-ai/cli flow visualize --output workflow.html

# Abrir web UI
npx @letra-ai/cli flow serve --open
```

## Monorepo Structure

```
packages/
├── cli/              # CLI (Commander, tsup build)
├── client/           # SPA React (Vite 6, Tailwind v4)
├── ui/               # Design system components
├── types/            # Shared TypeScript interfaces
└── design-toolkit/   # Playground + token validation (internal)
```

## Desenvolvimento

```bash
npm install
npm run dev            # Dev mode (CLI)
npm run dev:client     # Dev mode (Vite client)
npm run lint           # Biome check
npm run typecheck      # TypeScript check
npm test               # Vitest (111+ tests)
npm run build          # Build CLI + client
```

## Licença

MIT
