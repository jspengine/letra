# Spec — Adapter VSCode

## Outcome

Quando o Letra é inicializado em um projeto, o VSCode (com GitHub Copilot) lê automaticamente o contexto `.letra/` e segue as regras de constituição sem configuração manual.

## Constraints

- Usar `.github/copilot-instructions.md` (padrão do GitHub Copilot para VSCode em 2026).
- Criar `.vscode/settings.json` com configurações mínimas para melhorar a DX.
- Não exigir extensões pagas ou marketplace.
- O conteúdo deve referenciar `.letra/`, não duplicar.

## Exclusions

- **Não é um plugin**: Não vamos criar uma extensão `.vsix`.
- **Sem IntelliCode customizado**: Foco apenas na injeção de contexto do agente de código.

## Acceptance Criteria

- [x] **Geração de Instruções**: `letra init` cria `.github/copilot-instructions.md` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Settings do Editor**: `letra init` cria `.vscode/settings.json` com formatação e lint configurados para o projeto.
- [x] **Injeção de Contexto**: Ao abrir projeto no VSCode, o Copilot injeta os arquivos `.letra/` no system prompt.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar os arquivos de configuração na raiz.
- [x] **Sync automático**: `.github/copilot-instructions.md` é regenerado automaticamente em `flow move` e `letra focus` commands.

## Context

O VSCode é o editor mais usado no mundo. O GitHub Copilot agora usa `.github/copilot-instructions.md` como padrão para "regras do projeto" em 2026. Isso permite que o Letra funcione nativamente no VSCode sem plugins. O `.vscode/settings.json` complementa com DX (formatação automática, lint on save).
