## Acceptance Criteria

- [x] **Wizard de Tipo**: Pergunta "Qual o tipo do projeto?" com opções (web app, CLI, library, mobile).
- [x] **Wizard de Ferramenta**: Pergunta "Qual agente IA você usa?" com opções (OpenCode, Cursor, Windsurf, Claude Code, VSCode Copilot, Todos).
- [x] **Geração Adaptada**: Adapta conteúdo dos adapters baseado nas respostas (ex: web app gera regras de lint CSS, CLI gera regras de bin).
- [x] **Flag --yes**: `letra init --yes` usa valores padrão sem perguntar.
- [x] **Config Otimizado**: Ajusta severity das heurísticas baseado no tipo de projeto (ex: projetos internos relaxam Detecção de Tom).
