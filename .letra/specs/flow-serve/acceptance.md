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
