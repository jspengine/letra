# ContextView

**Arquivo**: `packages/client/src/components/Context/ContextView.tsx`
**Propósito**: Visualização e edição dos arquivos de contexto do projeto (context.md, constitution.md, glossary.md, decisões).

## Layout
- Tabs no topo (Context, Constitution, Glossary, Decisions)
- DocumentEditor com markdown + preview
- Sidebar de decisões (lista com datas)

## Elementos principais
- Tab navigation
- `DocumentEditor` — editor markdown embutido
- Decision list com datas formatadas

## Tokens usados
`--border`, `--muted-foreground`

## Conformidade LDL
- [x] Layout limpo, foco no conteúdo (alinhado com "técnica sem ser fria")
- [ ] `DocumentEditor` duplicado em `../ui/`
- [ ] Raw buttons nas tabs — migrar para Button
- [ ] Sem cores semânticas além de border/muted — consistente mas sem personalidade visual
