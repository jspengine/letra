# Spec: harness-loop-realtime

> Updated: 2026-06-22

## Outcome

Elevar o percentual de assertividade do loop real (Focus → Claim → AC → Move → Validate → UI reflete) de ~55% para ≥90%, eliminando bugs de sincronia, gaps de teste e surpresas comportamentais do agente.

## Constraints

- Zero dependências npm novas — sincronia usa mecanismos nativos (broadcast, state local)
- Testes de integração rodam sem servidor externo (usar `node:http` embutido)
- Animated dashed border sem JS runtime extra (SVG inline + CSS animation)
- `letra focus` sem `--claim` NUNCA modifica `claimedBy`
- Todo endpoint HTTP que modifica estado DEVE chamar `this.broadcast()`

## Exclusions

- CI/CD pipeline
- Performance/benchmarking
- Mobile/web não-Letra
- Mutation testing (Stryker): postergado

## Acceptance Criteria

### AC1 — Testes de integração do loop completo (HTTP + CLI)
- [x] **AC1.1**: `flow-serve.integration.test.ts` — sobe `FlowServer` em porta aleatória, POST `/api/items/:id/claim`, GET `/api/workflow`, verifica `claimedBy` populado
- [x] **AC1.2**: Release via `POST /api/items/:id/release` limpa `claimedBy` e `claimedAt`
- [x] **AC1.3**: Focus set via `POST /api/items/:id/focus` escreve `focus.md` com `itemId` correto
- [x] **AC1.4**: Focus clear via `DELETE /api/focus` remove `focus.md`
- [x] **AC1.5**: CLI integration — `child_process.fork` executa `focus <spec>` (sem --claim) e verifica claimedBy inalterado; `focus <spec> --claim` verifica claimedBy populado
- [x] **AC1.6**: CLI integration — `flow move ITEM-X --to review` verifica foco sincronizado via focus.md
- [x] **AC1.7**: 12+ testes de integração cobrindo claim/release/focus/focus-clear/move/broadcast
- [x] **AC1.8**: Broadcast verification — após cada ação, conecta SSE `/events`, aguarda evento `workflow-updated`, verifica recebimento

### AC2 — Disciplina de loop (comportamental)
- [x] **AC2.1**: `AGENTS.md` + todos os adapters incluem instrução: "Execute `letra ac done <ID>` após implementar cada AC"
- [x] **AC2.2**: `ac done` registra entrada `ac_done` no session-log com `itemId` e `acId`
- [x] **AC2.3**: `flow move --auto` emite WARNING se há ACs `[x]` sem entrada `ac_done` no log
- [x] **AC2.4**: Teste: implementa AC, executa `ac done`, verifica entrada no session-log
- [x] **AC2.5**: Teste: `--auto` bloqueia (exit 1) se validate falha

### AC3 — Auto-claim separado de focus
- [x] **AC3.1**: `letra focus <spec>` NÃO modifica `claimedBy`/`claimedAt` de nenhum item
- [x] **AC3.2**: `letra focus <spec> --claim` faz focus + claim (comportamento atual com opt-in)
- [x] **AC3.3**: `letra focus --clear` NÃO modifica `claimedBy` (já implementado, teste faltando)
- [x] **AC3.4**: `focus.ts` — remover lógica de auto-claim do bloco `if (spec)`, mover para `--claim`
- [x] **AC3.5**: Testes do focus command: sem `--claim`, claimedBy permanece undefined

### AC4 — Broadcast coverage 100%
- [x] **AC4.1**: Revisar TODOS os handlers em `flow-serve.ts` — broadcast ausente identificados (DELETE item, focus endpoints já corrigidos)
- [x] **AC4.2**: Comentário `// BROADCAST: <reason>` em cada handler que faz broadcast
- [x] **AC4.3**: DELETE `/api/items/:id` chama `this.broadcast()` (verificar se já existe)
- [x] **AC4.4**: Teste: após POST em cada endpoint, SSE entrega `workflow-updated`

### AC5 — State sync bidirecional (UI reflete servidor)
- [x] **AC5.1**: `KanbanView` — `focusItemId` atualizado localmente + via useEffect com `specRefreshKey`
- [x] **AC5.2**: `KanbanView` — todo clique em Focus/Claim/Release atualiza estado local + chama API
- [x] **AC5.3**: Teste: click Focus → verifica `focus.md` no disco + badge azul no card
- [x] **AC5.4**: Teste: click Claim → verifica `claimedBy` no workflow + borda tracejada
- [x] **AC5.5**: Teste: drag para Review → verifica claimedBy limpo + borda normal
- [x] **AC5.6**: Teste: SSE reconecta após restart do servidor (EventSource withReconnect)

### AC6 — Borda tracejada animada real (SVG marching)
- [x] **AC6.1**: Substituir `border: dashed` + breathing por SVG overlay com `stroke-dasharray="8 4"` + `stroke-dashoffset` animado
- [x] **AC6.2**: SVG `rect` posicionado com `position: absolute; inset: -2px; pointer-events: none; border-radius` igual ao card
- [x] **AC6.3**: Animação CSS: `@keyframes dash-march { to { stroke-dashoffset: -24; } }`
- [x] **AC6.4**: `prefers-reduced-motion` desliga animação
- [x] **AC6.5**: Usa `var(--live)` para cor — compatível dark/light
- [x] **AC6.6**: Opcional: componente React `MarchingBorder` reutilizável
- [x] **AC6.7**: Verificar que `rounded-lg` do card corresponde ao `rx` do SVG

### AC7 — Pulse/AC counting: specs sem `**AC**` marker
- [x] **AC7.1**: `pulse.ts countSpecACs` — fallback para `- [ ]` / `- [x]` quando não encontra `**AC**`
- [x] **AC7.2**: `spec-reader.ts parseACs` — mesmo fallback
- [x] **AC7.3**: `ac-counter.ts countInText` — mesmo fallback
- [x] **AC7.4**: Nenhuma duplicação se ambos os padrões existirem
- [x] **AC7.5**: Teste: spec com 20 `- [x]` sem `**AC**` → retorna 20/20
- [x] **AC7.6**: Teste: spec com `**AC1**` + `- [ ]` genéricos → contagem correta

### AC8 — Testes de regressão
- [x] **AC8.1**: `npm run test` passa (269+ testes)
- [x] **AC8.2**: Build limpo sem warnings novos
- [x] **AC8.3**: Nenhum `console.log` ou `.catch(() => {})` silencioso novo introduzido sem purpose

### AC9 — Error handling em chamadas de API (KanbanView)
- [x] **AC9.1**: Todos os `.then()` sem `.catch()` nos botões Focus/Claim/Release recebem `.catch()` com `console.warn`
- [x] **AC9.2**: `onItemMoved` com debounce: se chamado múltiplas vezes em rápida sucessão (ex: Claim + SSE), apenas uma requisição `/api/workflow` é feita
- [x] **AC9.3**: Teste: servidor offline → clique Claim → não quebra a UI, erro logado no console

### AC10 — `ac done` integrado com session-log
- [x] **AC10.1**: `ac.ts markAcById` — após modificar spec.md, registra entrada `ac_done` no session-log com `{ itemId, acId, spec }`
- [x] **AC10.2**: Entrada `ac_done` contém `acId`, `spec`, `itemId` (resolvido via workflow items)
- [x] **AC10.3**: Teste: `ac done AC1` → verifica entrada no session-log

### AC11 — Loading/optimistic state em botões
- [x] **AC11.1**: Botões de ação (Claim/Release/Focus) desabilitados durante chamada API (`disabled` prop)
- [x] **AC11.2**: Feedback visual: botão mostra texto reduzido ("..." ou "⏳") durante loading
- [x] **AC11.3**: Se API falha, botão volta ao estado anterior (não fica "travado")
- [x] **AC11.4**: Teste: mock `fetch` rejeita → UI não quebra, botão volta ao normal

### AC12 — `flow move --auto` valida antes de mover
- [x] **AC12.1**: `flow move --auto` executa `letra validate` no spec do item antes de mover
- [x] **AC12.2**: Se validate retorna erros, `--auto` emite WARNING e não move
- [x] **AC12.3**: Opção `--force` para pular validação
- [x] **AC12.4**: Teste: item com ACs pendentes → `--auto` não move, emite warning

### AC13 — SSE reconnection na web UI
- [x] **AC13.1**: `App.tsx` EventSource com `withReconnect`: reconecta automaticamente em caso de queda (retry exponencial: 1s, 2s, 4s... max 30s)
- [x] **AC13.2**: Notifica o usuário quando reconecta (badge/console.warn)
- [x] **AC13.3**: Teste: server restart → EventSource reconecta em ≤5s

## Context

Diagnóstico da sessão 17/06/2026 revelou 7+ categorias de falha no harness:

1. **Falta testes de integração** (raiz): fluxo real nunca é simulado → toda mudança manual introduz regressão
2. **Disciplina de loop**: ACs implementados não são marcados com `letra ac done`, pulse subnotifica, `--auto` move com ACs pendentes
3. **Auto-claim surpresa**: `letra focus` claima item automaticamente sem aviso ou opt-in
4. **Broadcast coverage incompleto**: endpoints de focus (POST/DELETE) não chamavam `this.broadcast()` → UI não re-renderizava
5. **State local vs servidor**: `focusItemId` no KanbanView não atualizava após ação porque `useEffect` dependia de `specRefreshKey` que não era incrementado
6. **Borda tracejada**: CSS `border-style: dashed` não anima `stroke-dashoffset` — movimento não é real
7. **AC counting no pulse**: `countSpecACs` busca padrão `**AC...**` em **3 funções** (pulse.ts, spec-reader.ts, ac-counter.ts) — specs sem esse marker subnotificam
8. **`ac done` não integra com session-log**: modifica spec.md mas não registra entrada, quebrando detecção de ACs implementados
9. **Silent errors**: botões Claim/Focus não têm `.catch()` — falha silenciosa
10. **`--auto` não valida**: move sem verificar `letra validate` primeiro
