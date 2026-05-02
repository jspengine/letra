# Acceptance Criteria — Adapter OpenCode

- [x] **Leitura de Contexto**: O OpenCode injeta `context.md`, `constitution.md` e `glossary.md` no system prompt ao iniciar sessão.
- [x] **Acesso a Specs**: O agente consegue executar `letra validate` e ler o output para saber quais critérios estão pendentes.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar um arquivo de configuração na raiz (ex: `AGENTS.md`).
- [x] **Validação no CI**: O pipeline do projeto (se houver) roda `letra lint` antes de merges.
