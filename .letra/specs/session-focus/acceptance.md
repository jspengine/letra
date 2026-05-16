# Acceptance Criteria — session-focus

- [ ] **`letra focus <spec>`**: Cria `.letra/focus.md` com nome, caminho e outcome da spec.
- [ ] **`letra focus`**: Exibe o conteúdo do foco atual (ou "Nenhum foco definido").
- [ ] **`letra focus --clear`: Remove `.letra/focus.md`**.
- [ ] **Adapter referencia focus.md**: `AGENTS.md` gerado pelo init inclui referência a `.letra/focus.md`.
- [ ] **Fallback silencioso**: Se `focus.md` não existe, agente comporta-se normalmente.
