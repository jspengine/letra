# Spec: workspace-discovery

> Updated: 2026-06-22

## Outcome

Usuário roda `letra init` e tem workspace próprio criado em `~/.letra/workspace/<project-id>/` sem acoplamento ao repositório local.

## Constraints

- Repositório do usuário não recebe arquivos `.letra/`.
- Harness versionado clonado em `~/.letra/harness/<version>/`.
- Compatibilidade retroativa NÃO é bloqueio na v1.

## Exclusions

- Sincronização automática entre workspace e projeto (adiado).
- Multi-repo scan complexo (simplificado para diretórios informados).

## Acceptance Criteria

- [x] `letra init` cria projeto no workspace global.
- [x] `letra init` gera `manifest.json` no diretório do usuário.
- [x] `letra init` clona harness padrão.
- [x] `letra status` mostra projetos do workspace.

## Context

Épico 4 do roadmap. Quebra acoplamento histórico com `.letra/` local. Base para todos os outros épicos.
