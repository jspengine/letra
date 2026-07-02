# Shadcn First - Auditoria Final de Acessibilidade

**Item**: `ITEM-57`
**Date**: 2026-07-01
**Status**: Passed

## Escopo

A auditoria verificou os critérios de teclado, foco visível e ARIA após a
migração para primitives canônicos de `@letra/ui`.

## Evidência automatizada

`npm -w packages/client test`:

- 2 arquivos de teste aprovados
- 10 testes aprovados
- 4 cenários executados com `axe-core`
- 0 violações nos cenários auditados

Cenários cobertos:

- DocumentEditor em leitura e edição
- navegação principal por Tabs e ativação por teclado
- Label, Input, RadioGroup e Table canônicos
- Dialog full-screen e fechamento por Escape

A regra de contraste do axe foi desabilitada no jsdom porque depende de
renderização visual. O contraste foi verificado separadamente por conversão
OKLCH para luminância relativa no relatório
`amber-rebrand-accessibility.md`.

## Teclado e foco

- cards do Kanban possuem `tabIndex=0` e ativação por Enter ou Espaço
- Tabs usam papéis `tablist` e `tab`
- Dialog responde a Escape e preserva o contrato de retorno de foco
- o CSS global usa `:focus-visible` com outline de 2px e offset de 2px
- `prefers-reduced-motion` reduz animações não essenciais

## ARIA

- atualizações SSE usam `role="status"` e `aria-live="polite"`
- Dialog possui nome acessível
- campos de formulário possuem Label ou `aria-label`
- ícones e avatares redundantes são ocultados de tecnologia assistiva
- tabelas preservam elementos semânticos nativos

## Auditoria de elementos crus

A busca nas superfícies do cliente encontrou somente um `<button>` cru em
`components/ui/sidebar.tsx`. Ele pertence à implementação interna do primitive
Sidebar e não a uma superfície de produto, portanto está coberto pela exceção
definida no design aprovado.

Não foram encontrados em superfícies de produto:

- `<input>`
- `<select>`
- `<textarea>`
- `<dialog>`
- `<details>`

## Build

`npm run build` concluiu com sucesso para:

- `@letra/ui`
- cliente React
- CLI

O bundler manteve apenas o aviso conhecido de chunk do cliente acima de 500 kB,
sem falha de compilação.

## Resultado

Os critérios de acessibilidade do `AC23` estão atendidos com evidência
automatizada e estática. A inspeção visual humana continua recomendada como
gate de Review, mas não há pendência técnica bloqueante conhecida.
