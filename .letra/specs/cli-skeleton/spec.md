# Spec: CLI Letra — Skeleton

## Outcome

Desenvolvedor e não-desenvolvedor podem inicializar um projeto com `.letra/`, criar specs thin, e validar se artefatos cumprem acceptance criteria via CLI.

## Constraints

- TypeScript, Node.js 22+
- Distribuição via binário standalone (bun build --compile)
- Comandos: `init`, `spec new`, `validate`, `drift`, `sync`
- Adapter OpenCode funcional no dia 1

## Exclusions

- Não suporta multi-repo na v0.1
- Não integra com CI/CD na v0.1
- Não gera código a partir de specs (só valida)

## Acceptance Criteria

- [ ] **`letra init`**: Cria `.letra/` com templates em qualquer diretório.
- [ ] **`letra spec new <nome>`**: Cria pasta de spec com template preenchido.
- [ ] **`letra validate`**: Lê acceptance criteria e reporta pass/fail por critério.
- [ ] **`letra lint`**: Valida formato e completude das specs (exit 0 ou 1).
- [ ] **Binário standalone**: Funciona sem Node.js instalado.

## Context

Primeiro milestone do projeto. O objetivo é ter um CLI mínimo que prove o conceito de `.letra/` como formato de memória agnóstica. Adapter OpenCode é o primeiro porque já estamos usando OpenCode — dogfood imediato.
