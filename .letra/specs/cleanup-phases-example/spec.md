# Spec: cleanup-phases-example

> Updated: 2026-06-22

## Outcome

As phases de exemplo do code-review stage no workflow.json são removidas do JSON e movidas para o SDLC template YAML como referência oficial. O workflow.json mantém-se limpo (sem phases) — quem quiser phases usa o template.

## Constraints

- workflow.json não deve conter dados de exemplo/placeholder.
- Template YAML existente em `packages/cli/src/harness/default/v0.1.0/flows/sdlc.yaml` deve ser a fonte única da verdade para definição de stages com phases.

## Exclusions

- Não alterar o engine de phases — apenas mover o exemplo do JSON para o YAML.

## Acceptance Criteria

- [x] **AC1**: Campo `phases` removido do code-review stage em `.letra/workflow.json`.
- [x] **AC2**: SDLC template YAML ganha `code-review.phases` idêntico ao que estava no JSON (auto-review → code-fix → re-review → human-review).
- [x] **AC3**: Após mover, `letra flow phases <item>` em item no code-review carrega phases do `BUILTIN_PHASES` no engine (fallback JS) corretamente.
- [x] **AC4**: Nenhum stage sem phases definidas (ex: backlog, done) é afetado.
- [x] **AC5**: `letra validate` passa sem warnings novos.

## Context

As phases foram adicionadas diretamente no workflow.json durante desenvolvimento do flow-phases-engine para testes rápidos. Agora que o engine está estável, o lugar das phases é no template YAML — o workflow.json deve ser apenas instância, não definição.
