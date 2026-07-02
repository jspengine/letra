# Spec: ci-cd-pipeline

> Updated: 2026-06-22

## Outcome

O repositório possui um pipeline de CI (GitHub Actions) que valida as specs e o código a cada push e PR. Se as specs estiverem inválidas ou os testes falharem, o merge é bloqueado.

## Constraints

- O pipeline deve rodar `letra lint` e testes.
- Deve usar Node.js 22+ (versão definida no package.json).
- Deve ser rápido (cache de node_modules).
- Deve rodar em pushes e PRs para `main` e `development`.

## Exclusions

- Não vai cobrir deploy de produção nesta spec.
- Não vai rodar build de binário no CI (apenas validação).

## Acceptance Criteria

- [x] **Lint Gate**: O CI falha se `letra lint` detectar erros nas specs.
- [x] **Test Gate**: O CI falha se os testes unitários (vitest) falharem.
- [x] **Validação de Formato**: O CI roda `tsc --noEmit` para checar tipos.
- [x] **CI em `development`**: Pipeline roda em pushes e PRs para `development`.
- [x] **CI em `main`**: Pipeline roda em pushes e PRs para `main`.
- [x] **Branch Protection**: `main` e `development` exigem PR com CI verde para merge.

## Context

Este pipeline é a "rede de segurança" do projeto. Garante que o dogfood funcione não só localmente, mas também no repositório compartilhado.
