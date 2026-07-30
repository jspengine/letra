# Spec: Arquitetura Universal de Adapters v2 e Codex Nativo

> Updated: 2026-07-04
> Item: ITEM-64
> Status: Review

## Outcome

O Codex torna-se uma ferramenta oficialmente suportada pelo Letra e os adapters passam a projetar a mesma direção vigente do harness pela melhor superfície disponível em cada ferramenta. Instruções, contexto vivo, operações controladas e auditoria compartilham um contrato único.

## Constraints

- Harness e workspace permanecem como únicas autoridades; adapters são projeções.
- A solução deve ser local-first, offline e multiplataforma.
- `AGENTS.md` compartilhado deve possuir um único escritor.
- Conteúdo do usuário, especialmente `.codex/config.toml`, deve ser preservado.
- CLI, MCP e adapters devem reutilizar o mesmo serviço de direção.
- Mutações devem passar pelos guardas de domínio e gates humanos.
- Capacidades indisponíveis devem produzir fallback e degradação explícitos.
- Cada AC exige evidência de regressão.

## Exclusions

- Tornar todos os adapters MCP-native nesta entrega.
- Publicar plugin ou serviço remoto.
- Configurar modelo, autenticação, sandbox ou preferências pessoais do Codex.
- Usar hooks como autoridade de domínio.
- Reescrever workflow, gates ou todos os adapters existentes.

## Acceptance Criteria

- [x] **AC1 — Registro e capacidades**: Codex e adapters possuem registro tipado de capacidades.
- [x] **AC2 — Propriedade de artefatos**: Artefatos compartilhados possuem escritor único e geração determinística.
- [x] **AC3 — Direção canônica**: Um serviço único produz snapshot estruturado, versionado e fiel ao harness.
- [x] **AC4 — Bootstrap Codex**: O adapter compõe instruções, configuração e skill sem destruir conteúdo do usuário.
- [x] **AC5 — Contexto vivo**: MCP read-only reflete mudanças canônicas na mesma sessão.
- [x] **AC6 — Operações controladas**: Validação, AC e transição reutilizam domínio, revisão e auditoria.
- [x] **AC7 — Degradação transparente**: Fallback CLI mantém operação segura sem ocultar limitações.
- [x] **AC8 — Segurança e observabilidade**: MCP é confinado, validado e auditável.
- [x] **AC9 — Compatibilidade cross-adapter**: OpenCode e adapters legados permanecem funcionais.
- [x] **AC10 — Evidência e dogfooding**: Testes e uso real comprovam o contrato sem regressões.

## Context

O suporte atual ao Codex depende do `AGENTS.md` identificado como OpenCode, sem registro próprio ou atualização viva. O ITEM-63 melhorou a direção textual, mas manteve identidade, arquivo e estado dinâmico acoplados. Esta evolução separa essas responsabilidades e usa o Codex como primeira implementação completa de uma plataforma extensível.

Os critérios binários estão em `acceptance.md` e o desenho aprovado para implementação está em `design.md`.
