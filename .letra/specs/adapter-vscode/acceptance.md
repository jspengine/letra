# Acceptance Criteria — Adapter VSCode

- [ ] **Geração de Instruções**: `letra init` cria `.github/copilot-instructions.md` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [ ] **Settings do Editor**: `letra init` cria `.vscode/settings.json` com formatação e lint configurados para o projeto.
- [ ] **Injeção de Contexto**: Ao abrir projeto no VSCode, o Copilot injeta os arquivos `.letra/` no system prompt.
- [ ] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar os arquivos de configuração na raiz.
