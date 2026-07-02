# Spec: phase-ui-indicator

> Updated: 2026-06-22

## Outcome

O dashboard web (se existir) mostra a fase atual de cada item como um badge colorido no card. O badge exibe o label da fase, com cores diferentes por status (ex: auto-review = amber, human-review = blue, done = green). Cards em estágios sem phases não mostram badge.

## Constraints

- Componente React puro, zero runtime deps — segue o design system (OKLCH tokens, Tailwind v4).
- Badge é opcional no card — só aparece se `item.currentPhase` estiver definido.
- Cores mapeadas por fase: `auto-review` → warning/amber, `human-review` → info/blue, `code-fix` → danger/red, `re-review` → warning/amber.
- Fase desconhecida → cinza neutro.

## Exclusions

- Não implementar backend ou SSE para phase transitions no UI — apenas renderização.
- Não implementar botões de transição no badge (será item separado).

## Acceptance Criteria

- [x] **AC1**: Componente `PhaseBadge` criado em `packages/client/src/components/ui/badge.tsx`.
- [x] **AC2**: Recebe `phase: { id, label }` como prop e renderiza badge com label + cor.
- [x] **AC3**: Mapa de cores: `auto-review` → `oklch(0.75 0.15 75)` (amber), `code-fix` → `oklch(0.65 0.2 25)` (red), `re-review` → `oklch(0.75 0.15 75)` (amber), `human-review` → `oklch(0.65 0.15 240)` (blue), fallback → `oklch(0.7 0 0)` (gray).
- [x] **AC4**: Card do kanban exibe `PhaseBadge` quando `item.currentPhase` existe.
- [x] **AC5**: Card em estágio sem phases (ex: backlog, done) não mostra badge.
- [x] **AC6**: Badge é pequeno (text-xs, px-1.5 py-0.5), posicionado na linha superior do card ao lado do typeTag.
- [x] **AC7**: Teste visual: item em code-review com phase "auto-review" mostra badge amber "Auto Review".
- [x] **AC8**: Dark mode: badge se adapta (cores mantêm contraste via OKLCH — `color-mix` com 15% alpha + cor pura como texto).

## Context

Usuário não vê a fase atual do item no dashboard — precisa rodar `letra flow phases <item-id>` no terminal. O badge no card dá visibilidade instantânea de onde cada item está dentro do estágio.
