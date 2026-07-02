# Acceptance Criteria — workspace-runtime-governance

- [ ] **AC1**: Existe uma definição formal aprovada em spec de que `workspace` é o único agregado raiz e de que `project` não pode existir como raiz concorrente nas novas superfícies
- [ ] **AC2**: O modelo conceitual do domínio passa a distinguir explicitamente `workspace`, `target`, `scope`, `team`, `agent`, `flow definition`, `flow run`, `run item` e `audit event`
- [ ] **AC3**: Fica definido um modelo entidade-relacionamento inicial que suporte configuração de pastas, equipes, fluxos, execução e auditoria sem ambiguidade de ownership
- [ ] **AC4**: Fica definida uma política explícita de armazenamento separando artefatos canônicos, derivados, evidências e trilha de auditoria
- [ ] **AC5**: Fica estabelecido que `PGlite` entra como read model local, índice de busca textual e base consultável de auditoria, com estratégia de reconstrução a partir das fontes canônicas
- [ ] **AC6**: Fica definido um contrato inicial para resolução de contexto ativo consumido por harness, adapters e LLMs, reduzindo dependência de heurísticas locais
- [ ] **AC7**: Fica formalizado que toda iteração relevante registra quem agiu, o que foi feito, quando ocorreu, sobre qual contexto e com qual evidência
- [ ] **AC8**: O desenho considera explicitamente governança de conteúdo gerado por IA, incluindo rastreabilidade de prompt, contexto, modelo e output
- [ ] **AC9**: O plano deixa claro quais partes são decisão estrutural de curto prazo e quais entram como rollout incremental posterior
