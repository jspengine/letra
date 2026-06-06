# Acceptance Criteria — Adapter Codex CLI

- [x] **Arquivo Compartilhado**: O `AGENTS.md` criado pelo `letra init` é lido tanto pelo OpenCode quanto pelo Codex CLI.
- [x] **Injeção de Contexto**: Codex CLI lê `AGENTS.md` ao iniciar, que referencia `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Acesso a Validação**: `AGENTS.md` instrui o agente a executar `letra validate` e ler o output.
- [x] **Não-intrusivo**: O adapter não modifica arquivos além do `AGENTS.md` na raiz.
