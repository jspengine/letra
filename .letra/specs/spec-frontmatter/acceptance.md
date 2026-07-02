# Acceptance Criteria — spec-frontmatter

- [ ] **CRUD**: CRUD completo para o recurso principal (GET, POST, PUT, DELETE retornam 200/201/204).
- [ ] **Autenticação**: Rota sem token retorna 401, rota com token inválido retorna 403.
- [ ] **Validação**: Payload inválido retorna 422 com mensagem de erro descritiva.
- [ ] **Rate Limit**: Exceder 100 req/min retorna 429 com header Retry-After.
- [ ] **Paginação**: GET com ?page=2&limit=10 retorna página correta com total count.