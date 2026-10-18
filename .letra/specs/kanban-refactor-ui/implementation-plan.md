# Plano de Implementação — Kanban UI Refactor (ITEM-98)

## Sequência de Entregas

As ACs estão agrupadas em 5 entregas ordenadas por dependência. Cada entrega tem ACs verificáveis independentemente.

---

### Entrega 1 — Fundação e Correção de Overflow (AC-1, AC-14, AC-10-parcial)

**Objetivo:** Corrigir o overflow visual e preparar a base para virtualização.

**Tarefas:**
1.1 — `packages/ui/src/patterns/kanban.tsx`: remover `overflow-x-auto` do container do KanbanBoard, substituir `min-w-max` por `min-w-0`.
1.2 — `packages/client/src/components/Flow/KanbanBoard.tsx`: garantir que botões de gate (GateDecisionActions) fiquem dentro dos cards (já estão, mas verificar z-index e clipping).
1.3 — `packages/client/src/components/Kanban/KanbanView.tsx`: remover `overflow-x-auto` do container principal (linha 206), substituir `min-w-[220px]` por `min-w-0` nos cards de coluna.
1.4 — Adicionar resize observer ou media query para detectar quando colunas excedem a largura disponível.

**ACs de verificação:**
- Cards não extrapolam o container em viewport estreita (screenshot/visual).
- Botões Aprovar/Solicitar/Rejeitar permanecem visíveis e dentro dos cards.
- Sem scroll horizontal no container principal (só nas colunas quando necessário).

---

### Entrega 2 — Busca Textual e Filtros (AC-2, AC-8, AC-15, AC-12-parcial)

**Objetivo:** Adicionar campo de busca no header e filtro em tempo real.

**Tarefas:**
2.1 — `KanbanBoard.tsx`: adicionar `<input>` de busca no header superior direito do board (dentro do container principal, acima das colunas).
2.2 — Filtro em tempo real por `item.id`, `item.description`, tags (campo `item.tags` se existir, senão por slug/spec vinculado).
2.3 — Contador de resultados: "{N} itens filtrados".
2.4 — Botão limpar (X) no campo de busca.
2.5 — Persistir termo de busca no `localStorage` (chave `kanban:searchQuery`).
2.6 — `KanbanView.tsx`: replicar campo de busca no header (se KanbanView ainda estiver em uso) ou marcar como legado.

**ACs de verificação:**
- Digitar no campo filtra cards instantaneamente (sem debounce > 300ms).
- Busca por ID parcial (ex: "ITEM-9" encontra "ITEM-98").
- Contador atualiza a cada caractere.
- Estado persiste entre recarregamentos (localStorage).

---

### Entrega 3 — Popup de Informações do Estágio (AC-3, AC-16)

**Objetivo:** Botão ℹ️ no header de cada coluna que abre modal com configuração completa do estágio.

**Tarefas:**
3.1 — Adicionar botão ℹ️ no header de cada coluna do KanbanBoard (`stageCols` render).
3.2 — Criar componente `StageInfoModal` (usar portal para renderizar fora do DOM flow).
3.3 — Modal exibe: nome do estágio, descrição, roles ativas com capabilities, executor preferido, fases e transições do workflow.
3.4 — Dados vêm de `workflow.stages` + `activeFlow.stages` (resolver via `orderedStages` + `stagePresentation`).
3.5 — Fechar com ESC ou clique fora.

**ACs de verificação:**
- Clicar ℹ️ abre modal com todas as informações do estágio.
- Modal usa portal (verificar DOM: elemento fora do container do board).
- Dados correspondem ao workflow.json da coluna.
- ESC fecha o modal.

---

### Entrega 4 — Redesign de Métricas e Filtros (AC-4, AC-5, AC-9)

**Objetivo:** Substituir cards redundantes por métricas estratégicas e melhorar UX dos filtros.

**Tarefas:**
4.1 — Remover cards de contagem dos filtros (onde houver — verificar se existem em KanbanBoard ou KanbanView).
4.2 — Remover cards de métricas simples duplicadas nos headers.
4.3 — Remover seção "Próximo trabalho" (se existir no código atual).
4.4 — Implementar filtro avançado como dropdown com opções traduzidas: "Todos", "Aguardando", "Em andamento", "Bloqueado", "Concluído".
4.5 — Substituir cards de contagem por cards de progresso: Velocidade, Lead Time, Taxa de conversão, Block Rate, Risk Score.
4.6 — Botões de detalhes (expandir métrica) e exportação (CSV/JSON).

**ACs de verificação:**
- Filtros dropdown mostram texto em português.
- Cards de progresso exibem dados numéricos reais do workflow (não placeholders).
- Botão exportação gera arquivo válido.
- Cards redundantes removidos (verificar DOM).

---

### Entrega 5 — Acessibilidade, Estado e Hardcoded Actors (AC-6, AC-7, AC-11, AC-12, AC-13)

**Objetivo:** Acessibilidade, persistência de estado, e remoção de hardcoded actors.

**Tarefas:**
5.1 — `flow.ts`: substituir `human:cli` hardcoded por `resolveLocalIdentity()` dinâmico (já parcialmente feito nos commands — verificar fluxo completo).
5.2 — `flow-handoff.ts`: resolver identity localmente (já usa `resolveLocalIdentity` no rollback; verificar handoff principal).
5.3 — `operation.ts`: garantir import de `resolveLocalIdentity` e usar como fallback (já feito na linha 55).
5.4 — Acessibilidade: manter `role="group"` nos cards (já presente em KanbanBoard), adicionar `aria-labels` nos botões de gate.
5.5 — Tab navigation entre colunas (roda Tab para焦点 nos cards, Enter para abrir).
5.6 — Painel de observações: mover para perto do Kanban, tornar colapsável por padrão, persistir estado no `localStorage` (chave `kanban:notesCollapsed`).
5.7 — Scroll horizontal: implementar quando colunas > largura da tela, com indicador visual (setas ou gradiente).

**ACs de verificação:**
- `flow move` sem `--actor` usa identity local automaticamente (teste: rodar comando e verificar actor no output).
- Cards possuem `role="group"` e `aria-label`.
- Tab navega entre colunas.
- Painel de observações colapsa e persiste.
- Scroll horizontal aparece apenas quando necessário + indicador visual.

---

## Dependências entre Entregas

- Entrega 2 depende de Entrega 1 (container corrigido).
- Entrega 3 depende de Entrega 1 (headers das colunas estáveis).
- Entrega 4 depende de Entrega 2 (filtros base).
- Entrega 5 é paralela com 3-4 (atuação no CLI, não no UI).

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Mudanças de layout quebram existência | Entrega 1 primeiro; testes visuais regressivos |
| Performance com muitos items | Virtualização (AC-10) na Entrega 1 como base |
| Botões de gate com z-index | Verificar z-index na Entrega 1, item 1.2 |
| Modal de estágio não recebe dados | AC-16 exige verificação contra workflow.json real |

## Critérios de Conclusão do Spec

- Todos os 16 ACs do spec resolvidos e verificados.
- Testes visuais passing em viewport 1280px e 768px.
- Sem regressão em `flow move`, `flow handoff`, `flow serve`.
- TypeScript compile sem erros (`npm -w packages/client run typecheck`).
