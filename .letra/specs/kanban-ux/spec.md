# Spec: Kanban UX — Card Enriquecido + Modal Full-Screen

> Updated: 2026-06-16
> Status: Draft

## Outcome

O usuário identifica de relance o tipo, progresso e estado de cada atividade no kanban sem precisar abrir o card. Ao abrir, vê a spec em modal full-screen com layout de leitura confortável e ações contextuais. A carga cognitiva de "o que é isso e onde estou" cai a zero.

## Constraints

- Card NUNCA mostra ID sequencial (`ITEM-N`) como informação primária — vira tooltip/info secundária
- `flow move N` funciona (auto-prefix com ITEM-N), sem quebrar `flow move ITEM-N`
- Tag de tipo (feat/bug/chore/docs) inferida por heurística (regex no spec name + descrição), não por campo novo
- Modal full-screen usa o componente `MarkdownView` existente — sem novo renderizador
- Modal full-screen respeita design system (OKLCH, dark/light, spacing tokens)
- Sidebar de metadados ~280px fixa no desktop, empilhada no mobile
- Nada quebrado: testes existentes passam, workflow.json schema inalterado

## Architecture

```
Card no Board
┌──────────────────────────┐
│ write-sync          FEAT │  ← slug (spec name | desc kebab) + tag
│ Motor de Sincronização…  │  ← desc truncada (max 40ch)
│ [████░░░░░░] 2/5 ACs     │  ← barra de progresso
│                    🤖 ago│  ← claim badge
│                          │
│  📎 spec.md              │  ← link curto pra spec
│  3d no estágio           │  ← idade
└──────────────────────────┘
        │ click
        ▼
┌──────────────────────────────────────────────────┐
│ ← Kanban Board                     [esc] ✕      │
├──────────────────────────────────────────────────┤
│ ┌────────┐  ┌──────────────────────────────┐    │
│ │  Meta  │  │  Spec (MarkdownView)          │    │
│ │ ────── │  │                              │    │
│ │ slug   │  │  # write-sync                │    │
│ │ FEAT   │  │  ## Outcome                  │    │
│ │ id: 34 │  │  Toda mutação de workflow…   │    │
│ │        │  │                              │    │
│ │ Review │  │  - [x] AC1: gateway          │    │
│ │        │  │  - [x] AC2: stage-drift      │    │
│ │ [Mover]│  │  - [x] AC3: flow-move        │    │
│ │ [Edit] │  │                              │    │
│ │ ────── │  │                              │    │
│ │ Hist.  │  │                              │    │
│ │ 12:00  │  │                              │    │
│ │ move   │  │                              │    │
│ └────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Acceptance Criteria

### AC1: Card com slug + tag

- [x] Card mostra slug (spec name → kebab-case, fallback: descrição truncada + kebab) como título primário
- [x] Card mostra tag colorida por tipo: FEAT (verde), BUG (vermelho), CHORE (azul), DOCS (roxo), TEST (laranja)
- [x] ID `ITEM-N` visível apenas no tooltip ao hover
- [x] Heurística de tipo: "fix", "bug", "hotfix" → BUG; "doc", "docs", "spec" → DOCS; "test", "teste" → TEST; default → FEAT
- [x] Tag cor usa tokens OKLCH do design system (não cor hardcoded)
- [x] Slug é estável: baseado no spec name (se item tem spec), fallback: primeira 3 palavras da descrição em kebab-case, calculado uma vez e cacheado
- [x] Slug NÃO muda se descrição muda — evita referência visual quebrada
- [x] Slug conflitante: se dois itens geram mesmo slug, adiciona sufixo numérico (`write-sync`, `write-sync-2`)

### AC2: Card com barra de progresso

- [x] Card mostra barra de progresso horizontal com ACs done/total
- [x] Se item não tem spec, barra não aparece (não mostra 0/0)
- [x] Barra usa cores do design system (amber para progresso, gray para fundo)
- [x] Se item não tem spec mas tem tasks, barra reflete progresso de tasks (tasks done/total)
- [x] Se não tem spec nem tasks, barra não aparece

### AC3: Card com claim badge

- [x] Se item claimed, mostra 🤖 opaco no canto inferior direito
- [x] Tooltip no badge: "Em andamento por opencode desde HH:MM"

### AC4: Card com metadados secundários

- [x] Card mostra "N dias no estágio" (cinza claro, canto inferior esquerdo)
- [x] Card mostra "📎 spec-name" se item tem spec linkada
- [x] Descrição truncada em 40 caracteres com ellipsis

### AC5: Modal full-screen ao clicar

- [x] Clicar no card abre modal full-screen (~90vw × ~90vh)
- [x] Fundo escurecido (overlay com `bg-overlay/50`)
- [x] Fecha com `esc`, clique no backdrop, ou botão ✕
- [x] Se houver edição não salva na spec, confirma "Descartar alterações?" antes de fechar
- [x] Animação de entrada: fade + scale sutil (~200ms)
- [x] Header do modal: "← Kanban Board" (volta) + slug + ✕
- [x] Link direto: `/board?item=ITEM-34` abre modal já no item específico

### AC6: Modal — sidebar de metadados

- [x] Sidebar esquerda (~280px) com: slug, tag tipo, ID (ITEM-N), estágio atual, progresso ACs, idade
- [x] Ações no sidebar: dropdown "Mover para..." + botão "Editar spec"
- [x] Seção "Atividades recentes" (últimos 5 eventos do session-log do item)

### AC7: Modal — spec renderizada

- [x] Área principal renderiza spec com `MarkdownView` (lazy load: spec carregada via API só quando modal abre)
- [x] Loading state: skeleton placeholder enquanto spec carrega
- [x] Modal escuta SSE `workflow-updated`: se item atual foi movido de estágio, mostra warning não-intrusivo no topo ("📦 ITEM-34 movido para Review") sem fechar o modal
- [x] Se item foi movido para done, modal exibe banner e botão "Fechar" em destaque
- [x] ACs clicáveis: toggle [ ]/[x] faz PATCH no spec.md + atualiza workflow
- [x] Code blocks com syntax highlighting
- [x] TOC lateral automática se spec > 200 linhas

### AC8: Modal — keyboard navigation (WCAG)

- [x] `Tab` navega entre elementos focáveis na ordem: sidebar → spec → header
- [x] `Enter` / `Space` ativa botão focado
- [x] `Esc` fecha modal (com confirmação se edição não salva)
- [x] Foco inicial vai pro primeiro elemento interativo da sidebar ao abrir
- [x] Foco fica trap dentro do modal enquanto aberto (não escapa pro board atrás)

### AC9: Modal — layout responsivo

- [x] Desktop: sidebar fixa + spec scroll
- [x] Tablet (< 1024px): sidebar colapsa em top bar com accordion
- [x] Mobile (< 640px): modal full-screen empilhado (meta → spec → ações)
- [x] Mobile: ações (Mover/Editar) fixas no bottom da viewport (sticky footer), nunca fora da tela

### AC10: CLI — flow move N

- [x] `letra flow move 34` funciona (auto-prefix: converte para ITEM-34)
- [x] `letra flow move ITEM-34` continua funcionando (back compat)
- [x] `letra flow move abc` erro se não for número nem ITEM-N válido

### AC11: CLI flow board mostra spec link

- [x] Board CLI exibe `📎 spec-name` ao lado de cada item que tem spec linkada
- [x] Board CLI exibe `⚠ sem spec` (amarelo) para itens fora do backlog sem spec
- [x] Board CLI exibe `⚠ spec não encontrada` (vermelho) se spec linkada não existe em disco
- [x] Info inline na mesma linha do item, sem coluna extra

### AC12: Board — empty state

- [x] Board com 0 itens mostra mensagem "Nenhum item no board" com CTA "Adicione seu primeiro item via `letra flow backlog add <desc>`"
- [x] Board com itens em apenas 1 coluna não quebra layout (colunas vazias mostram "(empty)" com opacidade reduzida)

### AC13: Nada quebrado

- [x] workflow.json schema inalterado
- [x] Testes existentes passam
- [x] `letra validate` OK
- [x] CLI commands que aceitam ITEM-N continuam aceitando

## Exclusions

- Drag-and-drop reordering (já existe via kanban)
- LET-1 como prefixo (documentado como FUTURE, não implementado)
- Notificações push
- Múltiplos agentes com claims simultâneos

## Future (não implementar agora)

- **LET-1**: substituir ITEM-N por LET-N como identificador. Impacta: schema, CLI commands, regex parsing, `nextItemId()`, testes, workflows existentes. Requer script de migração e período de compatibilidade.
