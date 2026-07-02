# Spec: document-editor

> Updated: 2026-06-23

## Outcome
Todas as visões de artefatos do Letra (Context, Constitution, Glossary, ADRs, Specs) usarão um componente `<DocumentEditor>` unificado com toggle read/edit, eliminando a duplicação entre visualização e edição.

## Constraints
- Compatível com `MarkdownView` existente (pode substituí-lo gradualmente)
- Edit mode: textarea com preview Markdown lado a lado (split view)
- Read mode: renderização Markdown idêntica à atual
- Salvamento via PATCH /api/context/:file ou PUT /api/specs/:id
- Zero runtime deps — usar apenas React state + fetch

## Exclusions
- Edição colaborativa multi-usuário
- Versionamento de histórico de edições (git já cobre)
- Drag-and-drop de imagens/arquivos no editor

## Acceptance Criteria

- [x] **AC1**: Componente `<DocumentEditor file={path} initialContent={string}>` com dois modos: `mode="read"` (renderiza Markdown igual MarkdownView atual) e `mode="edit"` (split view: editor à esquerda, preview à direita com debounce de 500ms). Toggle via botão "Editar" / "Visualizar" no header.
- [x] **AC2**: Em modo edit, textarea usa `--font-code` (JetBrains Mono), syntax highlight básico para Markdown (###, **, -, [ ]). Botão "Salvar" faz PUT/PATCH para API, "Cancelar" descarta mudanças com confirmação `window.confirm`.
- [x] **AC3**: ContextView substitui `MarkdownView` por `<DocumentEditor>` nos 4 arquivos (context.md, constitution.md, glossary.md, decisions). Decisions tab permite edição inline do arquivo selecionado.
- [x] **AC4**: SpecsView substitui navegação atual (ler → clicar "Editar" → outra tela) por `<DocumentEditor>` inline. Ao clicar "Editar" na spec, o painel direito alterna para edit mode sem mudar de rota.
- [x] **AC5**: Indicador visual de "não salvo" (bolinha amber no botão Salvar) quando há mudanças não persistidas. Salvamento automático não é necessário — explícito apenas.
- [x] **AC6**: Testes: render read mode, toggle para edit, editar conteúdo, salvar, cancelar com confirmação, indicador de não salvo.

## Context
Atualmente ContextView é readonly (MarkdownView) e SpecsView tem viewer/editor separados. Isso força o usuário a navegar entre telas para editar specs e impossibilita edição rápida de contexto/constituição/glossário. O DocumentEditor unifica tudo em um componente único com toggle de modo.
