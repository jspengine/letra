# SpecsView

**Arquivo**: `packages/client/src/components/Specs/SpecsView.tsx`
**Propósito**: Gerenciamento de specs — criar, editar, validar, visualizar acceptance criteria.

## Layout
- Split pane: lista de specs à esquerda, editor à direita
- Lista com badges de status (valid, errors, warnings)
- DocumentEditor com markdown + preview
- AC checklist interativo

## Elementos principais
- `DocumentEditor` — editor markdown + preview
- AC checklist com parse inline
- Badge de validação (valid/errors/warnings)
- Filtro de status

## Tokens usados
`--border`, `--card`, `--card-foreground`, `--error`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--success`, `--warning`

## Conformidade LDL
- [x] Estrutura de documentação (alinhado com "clareza operacional")
- [ ] `DocumentEditor` em `../ui/DocumentEditor` — duplicata, deve migrar
- [ ] Raw buttons na AC checklist — migrar para Checkbox de `@letra/ui`
- [ ] Ícones semânticos nas validações — verificar se usam cor do estado (brand rule)
