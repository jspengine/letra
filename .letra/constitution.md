# Constitution

> Regras não-negociáveis do projeto Letra
> Updated: 2026-05-01

## Arquitetura

- Adapter layer desde o dia 1 — nunca travar em uma IDE
- Formato `.letra/` é a fonte da verdade, não o código
- CLI deve ser extensível via plugins

## Código

- TypeScript estrito (`strict: true` no tsconfig)
- Biome para linting e formatação
- Testes para toda lógica de parsing e validação
- Zero dependencies desnecessárias — cada dependency precisa de justificativa

## Specs

- Thin specs: máximo 1 página por feature
- Markdown checklist para acceptance criteria
- Sem pseudo-código nas specs
- Toda spec deve ter: Outcome, Constraints, Exclusions, Acceptance Criteria, Context

## Workflow

- Spec atualizada como parte do Definition of Done
- PR sem spec atualizada = reject
- Dogfood: Letra é construído com Letra

## Segurança

- Nunca incluir secrets, tokens ou chaves no repositório
- Binário standalone para distribuição a não-devs
