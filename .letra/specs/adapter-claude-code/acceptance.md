## Acceptance Criteria

- [x] **Geração de Instruções**: `letra init` cria `CLAUDE.md` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Injeção de Contexto**: Ao iniciar sessão, o Claude Code injeta os arquivos `.letra/` no contexto.
- [x] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output.
- [ ] **Não-intrusivo**: O adapter não modifica arquivos além de criar `CLAUDE.md` na raiz.
