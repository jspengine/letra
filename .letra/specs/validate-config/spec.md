# Spec — Validate Config & Opt-out

## Outcome

Usuário pode configurar cada heurística do `letra validate` individualmente: desligar, rebaixar para warning, ou customizar parâmetros (ex: blacklist de tom, limite de caracteres, dias para drift).

## Constraints

- Configuração via arquivo `.letra/config.json` (ou `.letra.yaml`).
- Cada heurística deve ser independente — não pode haver cascade de falha.
- Default de todas as heurísticas: `severity: "warning"` (não bloqueia CI).
- A blacklist de tom deve ser extensível pelo usuário.
- O arquivo de config deve ser versionado (git).

## Exclusions

- **Não é UI interativa**: Config declarativa em arquivo, sem wizard.
- **Sem schema validation**: Por enquanto, só leitura direta do JSON/YAML.

## Acceptance Criteria

- [ ] **Arquivo de Config**: `letra init` cria `.letra/config.json` com todas as heurísticas listadas e `severity: "warning"`.
- [ ] **Severity Error**: Heurística com `severity: "error"` quebra o CI (exit 1).
- [ ] **Severity Warning**: Heurística com `severity: "warning"` exibe alerta mas não quebra (exit 0).
- [ ] **Severity Off**: Heurística com `severity: "off"` não executa nem alerta.
- [ ] **Custom Blacklist**: Usuário pode sobrescrever a lista de coloquialismos no config.
- [ ] **Custom Threshold**: Usuário pode alterar limite de caracteres do Conteúdo Mínimo e dias do Drift Temporal.
- [ ] **Backward Compatible**: Sem config, todas as heurísticas rodam como warning.

## Context

Atualmente as heurísticas são fixas e sempre executam com severity error. Isso gera atrito: um usuário que escreve specs em tom deliberadamente mais casual (ex: time pequeno, comunicação interna) não pode desligar a detecção de tom sem editar o código fonte. O sistema de configuração segue o padrão de linters (ESLint, Biome): cada regra tem severity configurável, e o usuário decide o que é blocker vs alerta vs ignorado. O default warning foi escolhido para não quebrar CI de quem está adotando o Letra pela primeira vez.
