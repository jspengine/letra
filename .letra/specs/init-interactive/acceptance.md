# Acceptance Criteria — init-interactive

- [ ] **Wizard de Tipo**: Pergunta "Qual o tipo do projeto?" com opções (web app, CLI, library, mobile).
- [ ] **Wizard de Ferramenta**: Pergunta "Qual agente IA você usa?" com opções (OpenCode, Cursor, Windsurf, Claude Code, VSCode Copilot, Todos).
- [ ] **Geração Adaptada**: Adapta conteúdo dos adapters baseado nas respostas (ex: web app gera regras de lint CSS, CLI gera regras de bin).
- [ ] **Flag --yes**: `letra init --yes` usa valores padrão sem perguntar.
- [ ] **Config Otimizado**: Ajusta severity das heurísticas baseado no tipo de projeto (ex: projetos internos relaxam Detecção de Tom).
