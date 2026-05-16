# Acceptance Criteria — session-focus

- [x] **`letra focus <spec>`**: Cria `.letra/focus.md` com nome, caminho e outcome da spec.
- [x] **`letra focus`**: Exibe o conteúdo do foco atual (ou "Nenhum foco definido").
- [x] **`letra focus --clear`: Remove `.letra/focus.md`**.
- [x] **Adapter referencia focus.md**: `AGENTS.md` gerado pelo init inclui referência a `.letra/focus.md`.
- [x] **Fallback silencioso**: Se `focus.md` não existe, agente comporta-se normalmente.
