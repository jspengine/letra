# Architecture Constraints

Leia este arquivo antes de iniciar qualquer atividade de desenvolvimento.
Ele define as regras arquiteturais que o agente deve seguir.

## Domain-Agnostic Principle

Letra é um framework SDD **agnóstico de domínio**.
Nenhuma suposição técnica deve ser hardcoded.
Toda suposição deve ser abstraída ou configurável.

## Design Governance

- Itens em **Design** só saem de lá após aprovação humana explícita.
- Mudanças estruturais (workspace, schema, arquitetura) exigem spec em Design primeiro.
- Não mover itens de Design para Code sem confirmação do usuário.

## Before Coding

1. Leia `.letra/context.md` para contexto completo do workspace.
2. Leia `.letra/focus.md` para saber qual item está ativo.
3. Identifique o estágio do item ativo no workflow.
4. Itens em **Design** são讨论 apenas — nunca implementar sem aprovação.
5. Consulte `.letra/specs/architecture-agnostic/spec.md` antes de qualquer refatoração estrutural.

## Regras Gerais

- **Specs antes de código**. Toda feature começa com uma spec aprovada.
- **Nada sem spec**. Nenhuma mudança no código é permitida sem um AC correspondente em `.letra/specs/`. Bypassar esta regra é violação grave.
- ACs no spec.md são a definição de done.
- Use `letra flow` commands para gerenciar o workflow, nunca edite workflow.json manualmente.
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`.

## Design do Letra

Letra não é um gerenciador de tarefas. Letra é uma **interface de supervisão para times de agentes autônomos**.

- Priorizar a atividade dos agentes sobre os cards.
- Toda ação de agente deve ser visível na UI (quem, o quê, quando, por quê).
- O usuário supervisiona, não opera — evitar CRUD pesado, drag-drop, formulários complexos.

## UI Framework

- **shadcn/ui é o framework oficial de UI** — todo componente deve vir de `@letra/ui` ou registry `@shadcn`
- HTML raw (`<button>`, `<select>`, `<input>`, `<textarea>`, `<table>`, `<dialog>`, `<details>`) é proibido para elementos interativos
- Layouts estruturais devem usar CSS Grid do Tailwind (`grid-cols-*`, `grid-rows-*`)
- Ao adicionar novo componente shadcn use: `npx shadcn@latest add <componente>`
