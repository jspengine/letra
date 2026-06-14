# Spec — Adapter Cursor

## Outcome

Quando o Letra é inicializado em um projeto, o Cursor lê automaticamente o contexto `.letra/` e segue as regras de constituição sem configuração manual.

## Constraints

- Usar arquivo `.cursorrules` na raiz do projeto (padrão do Cursor).
- Manter `.cursorrules` thin — referenciar arquivos `.letra/`, não duplicar conteúdo.
- Não exigir plugins ou extensões do marketplace; apenas configuração nativa.
- O arquivo gerado deve ser versionado (git).

## Exclusions

- **Não é um plugin VSCode**: Cursor é um fork independente com regras próprias.
- **Não é marketplace**: Nada para publicar na loja de extensões.

## Acceptance Criteria

- [x] **Geração de Regras**: `letra init` cria `.cursorrules` com referências a `.letra/context.md`, `.letra/constitution.md` e `.letra/glossary.md`.
- [x] **Injeção de Contexto**: Ao abrir projeto no Cursor, o agente injeta os arquivos `.letra/` no system prompt.
- [x] **Acesso a Validação**: Agente consegue executar `letra validate` e ler output para saber critérios pendentes.
- [x] **Não-intrusivo**: O adapter não modifica arquivos do projeto além de criar `.cursorrules` na raiz.
- [x] **Sync automático**: `.cursorrules` é regenerado automaticamente em `flow move` e `letra focus` commands, refletindo estado atual do workflow.

## Context

O Cursor é o segundo editor na lista de prioridades. É amplamente usado por devs e não-devs que querem "agent mode" sem configurar prompts manualmente. O `.cursorrules` é o equivalente ao `AGENTS.md` do OpenCode, mas com sintaxe própria do Cursor. A principal diferença é que o Cursor lê `.cursorrules` automaticamente ao abrir o workspace, sem necessidade de extensão extra.
