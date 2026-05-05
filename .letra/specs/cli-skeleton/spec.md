# Spec: CLI Letra — Skeleton

## Outcome

Desenvolvedor e não-desenvolvedor podem inicializar um projeto com `.letra/`, criar specs thin, e validar se artefatos cumprem acceptance criteria via CLI.

## Constraints

- TypeScript, Node.js 22+
- Distribuição via npm (npx)
- Comandos: `init`, `spec new`, `validate`, `lint`
- Adapter OpenCode funcional no dia 1

## Exclusions

- Não suporta multi-repo na v0.1
- Não integra com CI/CD na v0.1
- Não gera código a partir de specs (só valida)

## Acceptance Criteria

- [x] **`letra init`**: Cria `.letra/` com templates em qualquer diretório.
- [x] **`letra spec new <nome>`**: Cria pasta de spec com template preenchido.
- [x] **`letra validate`**: Lê acceptance criteria e reporta pass/fail por critério.
- [x] **`letra lint`**: Valida formato e completude das specs (exit 0 ou 1).
- [x] **Distribuição npm**: Funciona via `npx @letra/cli`.

## Context

Primeiro milestone do projeto. O objetivo é ter um CLI mínimo que prove o conceito de `.letra/` como formato de memória agnóstica. Adapter OpenCode é o primeiro porque já estamos usando OpenCode — dogfood imediato.
