# ItemDetailModal

**Arquivo**: `packages/client/src/components/Flow/ItemDetailModal.tsx`
**Propósito**: Detalhes completos de um item do workflow — spec, atividades, mover estágio.

## Layout
- Modal fullscreen/overlay
- Header: slug, tipo, estágio atual, dias no estágio
- Corpo: descrição, spec vinculada (ACs), atividades
- Footer: mover estágio, abrir spec, ações

## Elementos principais
- Spec preview com ACs (checklist)
- Activity list (timeline do item)
- Stage mover (dropdown + confirm)
- Markdown renderer

## Tokens usados
`--background`, `--border`, `--card`, `--error`, `--foreground`, `--muted-foreground`, `--overlay`, `--primary`, `--warning`

## Conformidade LDL
- [x] Overlay usa `--overlay` token
- [x] Foco no conteúdo do item (alinhado com "sinal antes de decoração")
- [ ] Usa `Markdown` de `../ui/markdown` — deve unificar para `@letra/ui`
- [ ] Raw `<button>` e `<input>` no stage mover — deve migrar para Button/Select
- [ ] Modal animation `modal-enter` — verificar se usa timing brand (`--motion-base`)
