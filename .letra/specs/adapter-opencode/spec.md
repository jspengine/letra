# Spec: adapter-opencode

> Updated: 2026-06-22

## Outcome

O agente do OpenCode lê automaticamente o contexto, constituição e specs do projeto (`*.letra/**`) sem precisar de configuração manual do usuário. Ao iniciar uma sessão, o agente já sabe as regras e restrições do projeto.

## Constraints

- O adapter deve usar o formato nativo de contexto do OpenCode (ex: `AGENTS.md`, `CLAUDE.md` ou arquivo similar na raiz).
- Não pode duplicar conteúdo; deve apontar para os arquivos `.letra/` ou usar `letra validate` como comando CLI.
- Deve funcionar com OpenCode local, sem depender de chaves de API externas.
- O adapter é o primeiro da lista; se funcionar aqui, a lógica será reaproveitada para Cursor e VS Code.

## Exclusions

- Não vai modificar a UI do OpenCode.
- Não vai criar extensões ou plugins complexos para o OpenCode — só configuração de arquivo.
- Não vai cobrir outros agents (Cursor, VS Code) nesta spec.

## Acceptance Criteria

- [x] **Leitura de Contexto**: O OpenCode lê `AGENTS.md` ao iniciar sessão, que referencia `context.md`, `constitution.md` e `glossary.md` como fontes da verdade do projeto.
- [x] **Acesso a Specs**: O agente consegue executar `letra validate` e ler o output para saber quais critérios estão pendentes.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar um arquivo de configuração na raiz (ex: `AGENTS.md`).
- [x] **Validação no CI**: O pipeline do projeto (se houver) roda `letra lint` antes de merges.

## Context

Como é nosso primeiro adapter, ele serve de prova de conceito (POC). O OpenCode é o ambiente onde estamos desenvolvendo o Letra (dogfood). Se o adapter funcionar aqui, o mesmo padrão de injeção de contexto via arquivo `.md` na raiz será adaptado para:

1. Cursor (`.cursorrules`)
2. VS Code (`copilot-instructions.md`)
3. Windsurf (`.windsurfrules`)

O objetivo é que o agente "pense" com as regras do projeto desde a primeira mensagem.
