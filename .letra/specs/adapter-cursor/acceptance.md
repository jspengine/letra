# Acceptance Criteria — Adapter Cursor

- [x] **Geração de Regras**: `letra init` cria `.cursorrules` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Injeção de Contexto**: Ao abrir projeto no Cursor, o agente injeta os arquivos `.letra/` no system prompt.
- [x] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output para saber critérios pendentes.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar `.cursorrules` na raiz.
