# Spec: init-interactive

> Updated: 2026-06-22

## Outcome

Usuário roda `letra init` sem argumentos e um wizard interativo pergunta o tipo de projeto, ferramentas e adapters desejados, gerando configuração otimizada sem precisar editar arquivos manualmente.

## Constraints

- Usar apenas stdin/stdout interativo (sem dependências como enquirer ou prompts)
- Fallback para modo silent/headless com `letra init --yes` (valores padrão)
- Gerar `.letra/config.json` com heurísticas ajustadas ao tipo de projeto
- O wizard deve ter no máximo 5 perguntas para não cansar o usuário

## Exclusions

- **Não é instalador**: Pressupõe Node.js já instalado
- **Sem UI gráfica**: Apenas terminal interativo

## Acceptance Criteria

- [x] **Wizard de Tipo**: Pergunta "Qual o tipo do projeto?" com opções (web app, CLI, library, mobile).
- [x] **Wizard de Ferramenta**: Pergunta "Qual agente IA você usa?" com opções (OpenCode, Cursor, Windsurf, Claude Code, VSCode Copilot, Todos).
- [x] **Geração Adaptada**: Adapta conteúdo dos adapters baseado nas respostas (ex: web app gera regras de lint CSS, CLI gera regras de bin).
- [x] **Flag --yes**: `letra init --yes` usa valores padrão sem perguntar.
- [x] **Config Otimizado**: Ajusta severity das heurísticas baseado no tipo de projeto (ex: projetos internos relaxam Detecção de Tom).

## Context

Hoje `letra init` é 100% silencioso e genérico — todo projeto recebe os mesmos adapters com o mesmo conteúdo. Usuários não-devs não sabem o que configurar. Um wizard de 5 perguntas reduz a barreira de entrada e já gera um setup sob medida. Inspirado no `npm init` e `create-vite`.
