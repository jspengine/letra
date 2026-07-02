# Header & LogoDiamond

**Arquivos**: `packages/client/src/components/Header/Header.tsx`, `LogoDiamond.tsx`
**Propósito**: Header global — branding, status, navegação secundária.

## Layout
- LogoDiamond (48px) à esquerda
- Nome do workflow + descrição
- Theme toggle (dark/light)
- Diagnostics indicator (badge de sugestões)
- Sync button
- Gate count badge

## Elementos principais
- `LogoDiamond` — SVG do símbolo da marca
- `DiagnosticsIndicator` — dropdown de sugestões
- Theme toggle button
- Sync button com estados (idle/syncing/success/error)

## Tokens usados
`--border`, `--foreground`, `--surface-1`, `--muted-foreground`

## Conformidade LDL
- [x] LogoDiamond segue brand guidelines (símbolo + wordmark)
- [x] Dark mode como padrão (alinhado com brand)
- [x] Layout limpo, sem decoração excessiva
- [ ] Header height 80px hardcoded — deve ser token
- [ ] Usa `goldman-bold` (Goldman font) — brand book especifica Sora, não Goldman
- [ ] DiagnosticsIndicator usa `--warning` como fundo — OK, mas `--brand-warning` seria melhor
