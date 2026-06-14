
# Spec adapter-codex-cli

## Outcome

O Codex CLI (OpenAI) lê automaticamente o contexto `.letra/` ao iniciar uma sessão, seguindo as regras de constituição sem configuração manual.

## Constraints

- Usar `AGENTS.md` na raiz do projeto (formato nativo do Codex CLI, compartilhado com OpenCode).
- Não duplicar conteúdo; referenciar arquivos `.letra/`.
- Não exigir plugins ou configuração extra — apenas o arquivo na raiz.

## Exclusions

- **Não é um plugin**: Codex CLI já lê `AGENTS.md` nativamente.
- **Sem extensões**: Nada para publicar em marketplace.

## Acceptance Criteria

- [x] **Arquivo Compartilhado**: O `AGENTS.md` criado pelo `letra init` é lido tanto pelo OpenCode quanto pelo Codex CLI.
- [x] **Injeção de Contexto**: Codex CLI lê `AGENTS.md` ao iniciar, que referencia `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Acesso a Validação**: `AGENTS.md` instrui o agente a executar `letra validate` e ler o output.
- [x] **Não-intrusivo**: O adapter não modifica arquivos além do `AGENTS.md` na raiz.

## Context

O Codex CLI (lançado pela OpenAI em 2025) lê `AGENTS.md` como formato nativo de instruções de projeto — o mesmo arquivo que o OpenCode usa. Isso significa que o adapter do OpenCode já cobre o Codex CLI automaticamente. Nenhuma alteração no `init.ts` é necessária; este adapter existe para documentar que o suporte já é nativo.
