## Acceptance Criteria

- [x] **Leitura de Contexto**: O OpenCode lê `AGENTS.md` ao iniciar sessão, que referencia `context.md`, `constitution.md` e `glossary.md` como fontes da verdade do projeto.
- [x] **Acesso a Specs**: O agente consegue executar `letra validate` e ler o output para saber quais critérios estão pendentes.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar um arquivo de configuração na raiz (ex: `AGENTS.md`).
- [x] **Validação no CI**: O pipeline do projeto (se houver) roda `letra lint` antes de merges.
