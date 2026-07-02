# Spec: flow-serve

> Updated: 2026-06-22

## Outcome

Usuário sobe um servidor web local que exibe o board do workflow em tempo real, acessível pelo navegador.

## Constraints

- Zero dependências externas — usa `node:http`, `node:fs`, `node:path`
- SSE (Server-Sent Events) para atualização em tempo real
- Interface HTML responsiva, sem framework JS
- Porta padrão 3000, configurável via `--port`
- Detecta mudanças no `.letra/workflow.json` via `fs.watch`
- Abre o navegador automaticamente com `--open`

## Exclusions

- WebSocket (SSE é suficiente para o MVP)
- Autenticação, HTTPS
- Build step ou bundler
- Hot reload com WebSocket

## Acceptance Criteria

- [ ] **`letra flow serve`** sobe servidor em `http://localhost:3000`
- [ ] **`letra flow serve --port 8080`** porta customizada
- [ ] **`letra flow serve --open`** abre navegador automaticamente
- [ ] **`GET /`** renderiza board HTML com header Letra + estágios + itens
- [ ] **Header**: Exibe logo Letra (SVG) + nome do workflow + status "Live"
- [ ] **3 opções de logo**: Disponíveis em `.letra/brand/` como SVG
- [ ] **`GET /api/workflow`** retorna JSON do workflow
- [ ] **`GET /events`** SSE; ao salvar workflow.json, envia `workflow-updated`
- [ ] Board HTML atualiza automaticamente via SSE
- [ ] Sem workflow: exibe mensagem "No workflow found"
- [ ] **Ctrl+C** para o servidor graciosamente
- [ ] Testado localmente antes do PR

## Context

Feature v0.3.0 do Flow. Primeiro passo para uma web UI. Arquitetura preparada para futuro: o `FlowServer` pode ser estendido com novas rotas e o HTML pode evoluir para SPA sem mudar a API.
