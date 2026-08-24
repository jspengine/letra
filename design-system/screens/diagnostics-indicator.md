# DiagnosticsIndicator

**Arquivo**: `packages/client/src/components/Diagnostics/DiagnosticsIndicator.tsx`
**Propósito**: Indicador de diagnósticos e sugestões automáticas do sistema.

## Layout
- Badge circular no header (âmbar quando há sugestões)
- Dropdown ao clicar: lista de sugestões com título, descrição, botão "Aplicar"
- Link "Ver histórico"

## Elementos principais
- Badge circular com contagem
- Dropdown card com shadow
- Suggestion list
- Apply button

## Tokens usados
`--border`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--warning`

## Conformidade LDL
- [x] Badge âmbar para alertas (alinhado com semântica: warning = amber)
- [x] Dropdown com `--card` e shadow — consistente
- [x] Funcionalidade de "sinal antes de decoração" (brand principle #2)
- [ ] Raw `<button>` no trigger e nos apply buttons — migrar
- [ ] Badge circular com `style={{ background: "var(--warning)" }}` — inline style, ideal como classe
- [ ] Sem animação brand motion no dropdown
