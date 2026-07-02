# v0.4.0 — Flow MVP + Web UI + Design System

> Release date: 2026-06-14

## Overview

This release transforms Letra from a CLI-only spec tool into a full **AI Memory & Spec Hub** with a rich SPA web UI, workflow engine, design system, and data resilience layer. Non-devs can now manage specs, track workflow, and monitor project health through a browser interface.

---

## New CLI Commands

### `letra decision`
- `letra decision new <title>` — Registro de Decisão com template Contexto → Decisão → Consequências
- `letra decision list` — Lista todos os registros em `.letra/decisions/`

### `letra focus`
- `letra focus <spec>` — Define o foco da sessão atual, extrai o Outcome da spec
- `letra focus` — Exibe o foco atual
- `letra focus --clear` — Limpa o foco

### `letra flow init`
- `--quick` — Setup rápido com 3 perguntas (nome, estágios, ferramentas)
- Detecta ferramentas existentes (Cursor, Claude Code, Windsurf, VS Code, OpenCode)
- Detecta nome do projeto via `package.json`
- Cria `.letra/workflow.json` com versão 1.0
- Backup automático para `.letra/backups/` antes de sobrescrever

### `letra flow backlog`
- `backlog add <description>` — Adiciona item ao primeiro estágio com ID auto-incremental (ITEM-N)
- `backlog list` — Lista todos os itens com estágio e idade
- `backlog import github <repo>` — Importa issues do GitHub (filtro `--label`, `--limit`, usa `GITHUB_TOKEN`)
- `backlog import linear <team>` — Importa issues do Linear (usa `LINEAR_API_KEY`, filtra por `todo`/`inProgress`)

### `letra flow move`
- Move itens entre estágios por ID ou descrição
- Regenera automaticamente adapters (AGENTS.md, .cursorrules, CLAUDE.md, etc.)
- Adaptadores refletem estágio atual e itens ativos

### `letra flow board`
- Board visual com estágios, contagem de itens, itens ativos
- Estágios vazios marcados como (empty)
- Idade de cada item (today, Nd ago)

### `letra flow visualize`
- Gera diagrama Mermaid do fluxo de trabalho
- `--output file.md` — Mermaid codeblock
- `--output file.html` — Mermaid renderizado via CDN
- Sem `--output`: imprime URL do `mermaid.live/edit`

### `letra flow edit`
- `--name`, `--desc` — Atualiza metadados do workflow
- Incrementa versão automaticamente (minor bump)
- Salva backup versionado: `.letra/workflow.v{version}.json`

### `letra flow diff`
- `flow diff` — Mostra diff entre versão atual e último backup
- `flow diff v1 v2` — Compara duas versões específicas
- Detecta: mudança de nome, estágios adicionados/removidos, itens novos/movidos/removidos

### `letra flow export / import`
- `flow export --minified` — Exporta workflow como JSON (pretty ou minified)
- `flow import <file>` — Importa workflow de arquivo JSON com validação

### `letra flow serve`
- Servidor HTTP com REST API + SPA client
- `--port` (default 3000), `--open` (abre browser)
- Server-Sent Events para live reload
- Webhook system (notifica URLs ao mover itens)

---

## Web UI (SPA React)

Acesse via `letra init --serve` ou `letra flow serve`. Interface dividida em 4 abas:

### Home
- 4 métricas: specs válidas/totais, drift detection, foco atual, health (stale items)
- Pipeline mini-kanban com reordenação drag-and-drop
- Specs recentes com progresso dos ACs
- Decisões recentes
- Detecção de bottlenecks por estágio

### Specs
- Lista de specs com busca e 4 filtros (all/errors/warnings/valid)
- Visualizador/editor Markdown inline
- AC checklist com toggle
- Validação on-demand
- Criação e exclusão de specs

### Flow
- Kanban board com drag-and-drop (valida allow/deny transitions)
- Detail panel lateral: header + tasks + spec rendering
- Stage management: adicionar/remover/reordenar estágios
- Configuração por estágio: zone (todo/doing/done), color, allow transitions, validation checks
- Gerenciamento de webhooks (add/test/remove)
- Adicionar/remover itens do board

### Context
- 4 abas: context.md, constitution.md, glossary.md, decisions
- Visualização Markdown dos arquivos
- Decision browser com extração de título e formatação de data

---

## Design System (@letra/ui)

18 componentes shadcn-inspired com dark/light mode, zero runtime dependencies:

| Component | Variants / Props |
|---|---|
| **Button** | `default`, `secondary`, `outline`, `ghost`; sizes `sm`, `default`, `lg` |
| **Badge** | `default`, `secondary`, `outline`, `success`, `warning` |
| **Card** | `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` |
| **Icon** | 28 SVG icons: home, specs, flow, context, sun, moon, grid, plus, trash, check, edit, search, info, chevron, arrow, settings, user, alert, etc. |
| **Dialog** | `Dialog`, `ConfirmDialog` (danger variant), `PromptDialog` |
| **Checkbox** | Com label e onChange |
| **Input / Textarea** | Com aria-label, placeholder |
| **Skeleton** | `Skeleton`, `SkeletonCard` |
| **Toast** | `ToastProvider` + `useToast()` — success/error/info, 3s auto-dismiss |
| **Tabs** | Container com children render |
| **Progress** | Barra com `value`/`max`, `showValue`, `barColor` |
| **EmptyState** | Título + descrição + action slot |
| **Alert** | Variantes: info, success, warning, error |
| **Tooltip** | Posicionamento (top) |
| **Avatar** | Iniciais do nome |
| **cn()** | Utility de classnames |

Tokens CSS em OKLCH com ~70 variáveis: surface, text, border, brand, semantic.

---

## Enhanced Validation

8 heurísticas configuráveis via `.letra/config.json`:

| Heurística | Descrição | Severidade default |
|---|---|---|
| Conteúdo Mínimo | Outcome com mínimo de caracteres | warning |
| Consistência de Terminologia | Termos do glossário vs spec | warning |
| Detecção de Tom | Gírias e linguagem informal | warning |
| Drift Temporal | Specs desatualizadas (>30d) | warning |
| Seções Vazias | Placeholder content | warning |
| ACs sem Métrica | Critérios vagos sem métrica | warning |
| Baixa Confiança | "provavelmente", "talvez" | warning |
| Conflito entre Specs | ACs contraditórios (MECE) | warning |

### Output Formats
- `--format text` — Terminal colorido (default)
- `--format github-annotation` — `::error`/`::warning` para GitHub Actions
- `--format junit` — XML padrão para CI tools

### Watch Mode
- `--watch` — Re-valida automaticamente ao salvar (debounce 300ms)

---

## Spec Templates

3 templates built-in + diretório custom `.letra/templates/`:

| Template | Quando usar |
|---|---|
| `web-api` | Endpoints REST, GraphQL, websockets |
| `cli-tool` | Comandos, argumentos, exit codes |
| `mobile-feature` | Telas, navegação, estados |
| custom | Arquivos `.md` em `.letra/templates/` |

Placeholder substitution: `{{name}}`, `{{date}}`.
Cada spec gera `spec.md` + `acceptance.md`.

---

## Adapter System

| Ferramenta | Artefato | Atualização |
|---|---|---|
| Cursor | `.cursorrules` | Regenerado em `flow move` |
| Claude Code | `CLAUDE.md` | Regenerado em `flow move` |
| Windsurf | `.windsurfrules` | Regenerado em `flow move` |
| VS Code Copilot | `.github/copilot-instructions.md` | Regenerado em `flow move` |
| OpenCode | `AGENTS.md` | Regenerado em `flow move` |

---

## Data Resilience

- Backup automático: `.letra/backups/workflow-{timestamp}.json` antes de qualquer overwrite
- Versionamento semântico: `workflow.v{version}.json` a cada `flow edit`
- Merge preserva items/specLinks/tools em re-setup
- Fallback filesystem quando specLinks vazio

---

## Init Enhancements

- `--yes` — Pula prompts, usa defaults
- `--serve` — Inicializa e abre web UI
- Detecção de ferramentas (Cursor, Claude Code, Windsurf, VS Code, OpenCode)
- Pergunta interativa de tipo de projeto (web-app, cli, library, mobile)
- Gera `lessons-learned.md`

---

## Config System

`.letra/config.json` com `heuristics` configuráveis:

```json
{
  "heuristics": {
    "conteudo-minimo": { "severity": "warning", "minChars": 50 },
    "drift-temporal": { "severity": "warning", "maxDays": 30 },
    "detecao-tom": { "severity": "warning", "blacklist": ["tipo","tá","pra"] }
  }
}
```

Defaults adaptados por tipo de projeto (web-app, cli, library, mobile).

---

## REST API (flow serve)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/workflow` | Obter workflow |
| PATCH | `/api/workflow` | Atualizar workflow |
| POST | `/api/workflow/template` | Criar de template |
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

---

## Monorepo Structure

```
packages/
├── cli/          # CLI principal (Commander, tsup)
├── client/       # SPA React (Vite, Tailwind v4)
├── ui/           # Design system components
├── types/        # Shared TypeScript interfaces
└── design-toolkit/  # Visual playground + token validation (internal)
```

---

## Changelog Detail

### Added
- `decision` command (new/list)
- `focus` command (set/view/clear)
- `flow backlog import github` / `linear`
- `flow edit` / `flow diff`
- `flow export` / `flow import`
- `flow visualize` with Mermaid + HTML output
- `flow serve` with REST API + SPA
- SPA React UI with 4 tabs (Home, Specs, Flow, Context)
- 18 UI components in `@letra/ui`
- Design toolkit with playground + token validation
- Spec templates: web-api, cli-tool, mobile-feature
- Validation: 8 heuristics, 3 output formats, watch mode
- Data resilience: backups, versioning, merge
- Webhook system for item.moved events
- Server-Sent Events for live reload
- `init --serve` flag
- Session focus with `.letra/focus.md`
- Cross-spec conflict detection
- Custom template directory `.letra/templates/`

### Changed
- Monorepo restructure: packages/cli, packages/client, packages/ui, packages/types
- `flow init` now detects tools and project name
- `flow move` regenerates adapters automatically
- Validation heuristics configurable via `.letra/config.json`
- Init generates AI tool-specific adapters
- ESM-only (no CJS support)

### Fixed
- Data loss on re-setup (merge instead of overwrite)
- Console spy in tests (no output pollution)
- CI: init before lint/validate
