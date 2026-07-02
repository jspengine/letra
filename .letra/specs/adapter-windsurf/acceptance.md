## Acceptance Criteria

- [x] **Geração de Regras**: `letra init` cria `.windsurfrules` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Injeção de Contexto**: Ao abrir projeto no Windsurf, o agente injeta os arquivos `.letra/` no contexto.
- [x] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output.
- [x] **Não-intrusivo**: O adapter não modifica arquivos além de criar `.windsurfrules` na raiz.
- [x] **Sync automático**: `.windsurfrules` é regenerado automaticamente em `flow move` e `letra focus` commands.
