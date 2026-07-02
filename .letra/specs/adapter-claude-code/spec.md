# Spec: adapter-claude-code

> Updated: 2026-06-22

## Outcome

O Claude Code (Anthropic) lê automaticamente o contexto `.letra/` ao iniciar uma sessão, seguindo as regras de constituição sem configuração manual.

## Constraints

- Usar `CLAUDE.md` na raiz do projeto (formato nativo do Claude Code).
- Não duplicar conteúdo; referenciar arquivos `.letra/`.
- Não exigir plugins ou extensões do marketplace; apenas configuração nativa.

## Exclusions

- **Não é um plugin**: Claude Code já lê `CLAUDE.md` nativamente.
- **Sem sync automático**: O `CLAUDE.md` é gerado no `init`, não re-sincronizado.

## Acceptance Criteria

- [x] **Geração de Instruções**: `letra init` cria `CLAUDE.md` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Injeção de Contexto**: Ao iniciar sessão, o Claude Code injeta os arquivos `.letra/` no contexto.
- [x] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output.
- [ ] **Não-intrusivo**: O adapter não modifica arquivos além de criar `CLAUDE.md` na raiz.

## Context

Claude Code é o agente de terminal da Anthropic. Usa `CLAUDE.md` na raiz como formato de instruções de projeto, mesmo conceito do `AGENTS.md`. É o terminal-agent mais usado em 2026. O adapter segue o mesmo padrão dos outros: criar um arquivo markdown na raiz que referencia `.letra/`.
