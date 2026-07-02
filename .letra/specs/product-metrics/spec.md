# Spec: product-metrics

> Updated: 2026-06-23

## Outcome
Usuário consegue fazer requisições HTTP para a API e receber respostas padronizadas.

## Constraints
- RESTful遵循 (GET, POST, PUT, DELETE)
- Autenticação via Bearer token JWT
- Rate limiting: 100 req/min por usuário
- Timeout máximo de 30s por requisição

## Exclusions
- WebSocket não está no escopo
- Upload de arquivos não está no escopo inicial

## Acceptance Criteria
- [ ] **CRUD**: CRUD completo para o recurso principal (GET, POST, PUT, DELETE retornam 200/201/204).
- [ ] **Autenticação**: Rota sem token retorna 401, rota com token inválido retorna 403.
- [ ] **Validação**: Payload inválido retorna 422 com mensagem de erro descritiva.
- [ ] **Rate Limit**: Exceder 100 req/min retorna 429 com header Retry-After.
- [ ] **Paginação**: GET com ?page=2&limit=10 retorna página correta com total count.

## Context
Template para APIs REST. Adaptado para o domínio específico do projeto.