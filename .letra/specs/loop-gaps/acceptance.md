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
