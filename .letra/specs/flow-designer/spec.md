# Spec: Flow Designer

> Updated: 2026-06-13

## Outcome

Flow view evoluída de kanban estático para ferramenta visual de design de fluxo de trabalho. Usuário pode configurar stages (criar, renomear, reordenar, excluir), definir regras de transição entre stages, e gerenciar itens com drag & drop que respeita as regras. Rotas de API para CRUD de itens implementadas no backend.

## Constraints

- Modelo de dados Workflow/Stage/Item existente não pode ser quebrado
- Regras de transição (`allow`) e validação (`validate`) são campos opcionais no Stage — zero impacto em workflows existentes
- Drag & drop nativo HTML5 mantido (sem novas deps)
- Zero dependências runtime externas
- Stage editor é inline no FlowView (não modal/wizard separado)

## Acceptance Criteria

- [ ] **Rotas /api/items**: POST (criar item), PATCH /api/items/:id (mover/toggle tasks), DELETE /api/items/:id implementadas no flow-serve
- [ ] **Stage schema**: Stage ganha campos opcionais `allow: string[]` (stage IDs permitidos como destino) e `validate: string[]` (checklist de validação ao mover)
- [ ] **Manage Stages UI**: botão no FlowView header abre inline stage editor com lista de stages — cada stage tem nome editável, zona select, allow (multi-select de stages), validate (checklist editável), botão excluir (com confirmação)
- [ ] **Drag & drop respeita allow**: ao arrastar item para coluna, se stage destino não estiver em `allow` do stage origem, o drop é rejeitado com feedback visual (ring red) e toast de erro
- [ ] **Validate checklist**: ao mover item via drag ou botão, se stage origem tem `validate`, exibe mini-dialog checklist antes de confirmar o movimento
- [ ] **Integração workflow.json**: alterações no stage editor persistem via PATCH /api/workflow, SSE broadcast notifica outros clients
- [ ] **Botão Add Stage**: no inline stage editor, permite criar novo stage com nome, zona, allow vazio
- [ ] **Reordenação**: stages podem ser reordenados por drag & drop no inline editor

## Exclusions

- Não implementar automações (regras condicionais com gatilhos) — será ITEM-7
- Não implementar métricas de fluxo — será ITEM-10
- Não implementar template marketplace — será ITEM-6
- Não alterar o CLI (comandos flow backlog, flow move continuam funcionando)

## Context

A ITEM-13 foi parcialmente implementada: specLinks, tasks nos itens, drag & drop nativo, visual feedback. O que falta é a parte de "designer" — o usuário não consegue configurar stages visualmente depois do setup inicial, e as rotas de API para CRUD de itens nunca foram implementadas no backend (o client chama POST/PATCH/DELETE /api/items mas recebe 404). Este spec completa o item.

Decisões:
- Stage editor inline, não modal — usuário vê o kanban enquanto edita stages
- `allow` é lista de stage IDs — simples, sem engine de regras complexa
- `validate` é checklist de strings — sem engine de expressões, apenas pré-condições textuais
- Persistência via PATCH /api/workflow — reusa rota existente ou adiciona nova
