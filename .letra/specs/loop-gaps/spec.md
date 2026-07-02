# Spec: loop-gaps

> Updated: 2026-06-22

## Outcome

Os gaps identificados durante o ITEM-37 são corrigidos: criação de item com sugestão de spec, pulse alerta sobre spec faltante, comando `letra spec link`, e dashboard reflete claim state. O loop de desenvolvimento fica mais apertado — menos steps manuais entre criar um item e ter tudo linkado.

## Constraints

- Nenhuma mudança no schema do workflow.json — só novos comandos CLI e melhorias em existing
- `letra spec link` usa `writeWorkflow()` com source `"spec-link"`
- Dashboard web: badge de claim apenas se item estiver em destaque e claimed
- Pulse: warning silencioso (não quebra output JSON)

## Exclusions

- Claim TTL/heartbeat (mantido como exclusion do ITEM-37)
- Quiet mode error handling (requer refatoração maior no writeWorkflow)
- Múltiplos agentes simultâneos

## Acceptance Criteria

### AC1: flow backlog add --spec

- [x] `flow backlog add <desc> --spec <name>` cria item com `spec` preenchido
- [ ] Se `--spec` não existe em `.letra/specs/`, erro: "Spec '<name>' não encontrada"
- [x] Se `--spec` não está em `specLinks`, registra automaticamente
- [ ] Sem `--spec`, comportamento unchanged (sem spec)

### AC2: Pulse alerta item sem spec

- [x] Pulse CLI mostra `⚠ sem spec` (amarelo) ao lado do item ativo se `item.spec` não preenchido
- [ ] Pulse --json inclui `missingSpec: true` no `currentItem` quando spec ausente
- [x] Warning só aparece se item ativo existe e está fora do backlog

### AC3: Comando letra spec link

- [ ] `letra spec link <item-id> <spec-name>` seta `item.spec = <spec-name>`
- [x] Se `spec-name` não encontrado em `.letra/specs/`, erro informativo
- [ ] Se `specLinks` não contém spec, registra automaticamente
- [ ] Usa `writeWorkflow()` com source `"spec-link"`, skipSitrep: true
- [ ] Gera entrada no session-log com action `"spec-link"`

### AC4: Dashboard web — claim badge

- [ ] Dashboard (home tab) mostra badge `🤖` no item em destaque se claimed
- [ ] Badge acinzentado se não há item em destaque
- [ ] Tooltip: "Em andamento por <agent>"

### AC5: Nada quebrado

- [ ] Testes existentes passam
- [ ] `letra validate` OK

## Context

-
