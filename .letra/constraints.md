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

- Specs antes de código. Toda feature começa com uma spec.
- ACs no spec.md são a definição de done.
- Use `letra flow` commands para gerenciar o workflow, nunca edite workflow.json manualmente.
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`.
