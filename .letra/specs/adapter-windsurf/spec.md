# Spec — Adapter Windsurf

## Outcome

O Windsurf (Cognition/Codeium) lê automaticamente o contexto `.letra/` ao abrir o projeto, seguindo as regras de constituição sem configuração manual.

## Constraints

- Usar `.windsurfrules` na raiz do projeto (formato nativo do Windsurf).
- Não duplicar conteúdo; referenciar arquivos `.letra/` com sintaxe `@`.
- Não exigir plugins; apenas configuração nativa.

## Exclusions

- **Não é um plugin**: Windsurf lê `.windsurfrules` nativamente.
- **Sem sync automático**: O `.windsurfrules` é gerado no `init`, não re-sincronizado.

## Acceptance Criteria

- [ ] **Geração de Regras**: `letra init` cria `.windsurfrules` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [ ] **Injeção de Contexto**: Ao abrir projeto no Windsurf, o agente injeta os arquivos `.letra/` no contexto.
- [ ] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output.
- [ ] **Não-intrusivo**: O adapter não modifica arquivos além de criar `.windsurfrules` na raiz.

## Context

Windsurf (ex-Codeium) é um IDE nativo de IA, adquirido pela Cognition em 2025. Usa `.windsurfrules` na raiz do projeto, similar ao `.cursorrules` do Cursor. É o terceiro AI-IDE mais usado em 2026 (atrás de Cursor e Copilot), com 1M+ de usuários. O adapter segue o mesmo padrão dos outros adapters.
