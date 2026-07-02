## Acceptance Criteria

### AC1: Schema

- [x] **AC1.1**: `HarnessItem` (types.ts) ganha `claimedBy?: string` e `claimedAt?: string`
- [x] **AC1.2**: `Item` (flow-init.ts) ganha `claimedBy?: string` e `claimedAt?: string`
- [x] **AC1.3**: `PulseData.currentItem` (pulse.ts) ganha `claimedBy?: string` e `claimedAt?: string`
- [x] **AC1.4**: workflow.json items podem conter campos opcionais `claimedBy`/`claimedAt`

### AC2: CLI — letra flow claim

- [x] **AC2.1**: `letra flow claim <item-id>` seta `claimedBy: "opencode"` + `claimedAt: now()` no item
- [x] **AC2.2**: Usa `writeWorkflow()` com source `"flow-claim"`
- [x] **AC2.3**: Se item já claimed por outro agente, avisa e pergunta "Deseja reassumir?" (overwrite após confirmação)
- [x] **AC2.4**: Se item já claimed pelo mesmo agente, avisa "Já está sob sua responsabilidade" e não duplica
- [x] **AC2.5**: `flow claim` em item com stage "done" → erro: "Item já concluído"
- [x] **AC2.6**: Se item não existe, erro informativo
- [x] **AC2.7**: Gera entrada no session-log com action `"item-claim"` e `itemId` do item claimado

### AC3: CLI — letra flow release

- [x] **AC3.1**: `letra flow release` remove `claimedBy` e `claimedAt` do item atualmente claimed (ou especificado via `--item`)
- [x] **AC3.2**: Usa `writeWorkflow()` com source `"flow-release"`
- [x] **AC3.3**: Se nenhum item claimed, avisa "Nenhum item em andamento"
- [x] **AC3.4**: Se múltiplos itens claimed pelo mesmo agente, libera todos (release all)
- [x] **AC3.5**: Se `--item` especificado, libera apenas aquele item (mesmo que de outro agente, com confirmação)
- [x] **AC3.6**: Gera entrada no session-log com action `"item-release"` e `itemId` do(s) item(ns) liberado(s)

### AC4: CLI — flow move e claim

- [x] **AC4.1**: Mover item pra "done" faz release automático (remove claimedBy/claimedAt)
- [x] **AC4.2**: Mover item entre estágios não-done (ex: code → review) preserva claim intacto
- [x] **AC4.3**: `flow move` com `--to done` explícito: se item claimed, avisa "Release automático: ITEM-N não está mais sob responsabilidade do agente"

### AC5: CLI — flow board exibe claim

- [x] **AC5.1**: Itens claimed mostram ícone `🤖` ao lado do ID (ex: `ITEM-34 🤖`)
- [x] **AC5.2**: Ícone consistente em todas as colunas

### AC6: CLI — pulse exibe claim

- [x] **AC6.1**: `pulse` mostra `🤖 Agent: opencode` no item ativo se claimed
- [x] **AC6.2**: `pulse --json` inclui `claimedBy` e `claimedAt` no `currentItem`

### AC7: CLI — backlog list exibe claim

- [x] **AC7.1**: Itens claimed na backlog list mostram `🤖` ao lado do ID

### AC7b: Web UI — botão claim no card

- [x] **AC7b.1**: Card do board tem botão `🤖 Claim` (ou `🤖 Release` se já claimed) no hover
- [x] **AC7b.2**: Um clique faz claim via `POST /api/items/:id/claim`
- [x] **AC7b.3**: SSE atualiza board sem refresh

### AC8: API — claim/release endpoints

- [x] **AC8.1**: `POST /api/items/:id/claim` → seta claimedBy/claimedAt, retorna item atualizado
- [x] **AC8.2**: `POST /api/items/:id/release` → remove claimedBy/claimedAt, retorna item atualizado
- [x] **AC8.3**: Ambos disparam SSE `workflow-updated`

### AC9: API — GET endpoints incluem claim

- [x] **AC9.1**: `GET /api/workflow` → items incluem claimedBy/claimedAt se presente
- [x] **AC9.2**: `GET /api/items/:id` → inclui claimedBy/claimedAt
- [x] **AC9.3**: `GET /api/pulse` → currentItem inclui claimedBy/claimedAt

### AC10: Web UI — Board cards

- [x] **AC10.1**: Card claimed tem glow pulsante (animação CSS) na borda
- [x] **AC10.2**: Card claimed tem badge `🤖 opencode` visível
- [x] **AC10.3**: Glow usa cor do tema (amber via OKLCH) — consistente com design system

### AC11: Web UI — Dashboard

- [x] **AC11.1**: Card em destaque no dashboard (se houver) mostra mesma badge
- [x] **AC11.2**: Indicador sutil de "em andamento" no header do dashboard

### AC12: Detector — missing-spec-link

- [x] **AC12.1**: Novo detector `missing-spec-link` registrado no engine
- [x] **AC12.2**: Detecta itens em estágios != "backlog" sem o campo `spec` preenchido
- [x] **AC12.3**: A cada scan, varre `workflow.items` e verifica `item.spec` para cada item fora do backlog
- [x] **AC12.4**: Resultado: sugestão tipo "info" com id `missing-spec-link_<item-id>`
- [x] **AC12.5**: Título: `ITEM-N: sem spec linkada`
- [x] **AC12.6**: Descrição: `O item ITEM-N (descrição) está em "<stage>" mas não tem spec associada. Link usando: letra flow edit ITEM-N --spec <nome>`
- [x] **AC12.7**: Se o item tem spec mas spec não está registrada em `specLinks`, detector também alerta
- [x] **AC12.8**: autoFix: gera kebab-case a partir da descrição e busca spec em `.letra/specs/<kebab>/spec.md`
- [x] **AC12.9**: autoFix fallback: se kebab-case da descrição não encontrar spec, varre `.letra/specs/` por substring match no nome da pasta
- [x] **AC12.10**: autoFix fallback 2: se não encontrar nenhuma correspondência, retorna `files: []` com log informando "Nenhuma spec candidata encontrada para link automático"

### AC13: Nada quebrado

- [x] **AC13.1**: workflow.json sem claimedBy/claimedAt continua funcional (campos opcionais)
- [x] **AC13.2**: Testes existentes continuam passando sem modificação
- [x] **AC13.3**: Mover item no kanban preserva claim
- [x] **AC13.4**: `letra validate` não reclama dos novos campos
