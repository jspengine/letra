# Evidências — Adapter Platform v2

## AC1 — Registro e capacidades

**Comportamento protegido**

- Os seis adapters existentes mantêm IDs, formatos, paths de instrução e geração.
- Detecção existente por artefato continua funcionando.
- Setup continua pré-selecionando somente adapters com evidência no target.
- Diagnóstico stale continua verificando as referências L1 e aplicando autofix.

**Evidência**

- Contrato público adicionado em `@letra/types` para capacidades, adapters e artefatos.
- Registro único publica Cursor, Claude Code, Windsurf, VSCode Copilot, OpenCode, Codex e Hermes.
- Codex aparece com capacidades nativas e detecção própria por `.codex/config.toml`.
- Setup expõe o perfil de capacidades sem inferir Codex apenas pela presença de `AGENTS.md`.
- Diagnóstico passou a derivar arquivos do registro em vez de manter uma tabela paralela.
- 94 testes afetados aprovados em 7 arquivos.
- Typecheck do CLI aprovado.
- Build completo de UI, client e CLI aprovado.

**Risco residual**

- OpenCode e Codex ainda solicitam escrita do mesmo `AGENTS.md` quando selecionados juntos. A duplicidade permanece visível e coberta como problema do AC2; não houve tentativa de ocultá-la dentro do AC1.
- Configuração e skill específicas do Codex estão registradas como artefatos, mas somente serão materializadas no AC4.

## AC2 — Propriedade de artefatos

**Comportamento protegido**

- Todos os arquivos de instrução legados continuam sendo gerados nos mesmos paths e formatos.
- `.opencode/instructions.md` mantém identidade específica do OpenCode.
- O planejamento de setup continua recebendo operações rastreáveis por target e ferramenta.

**Evidência**

- O compilador calcula a união de artefatos selecionados e percorre a ordem canônica do registro.
- `AGENTS.md` possui uma única definição compartilhada e identidade neutra para OpenCode e Codex.
- Teste de regressão falhou antes da correção com duas renderizações de `AGENTS.md`.
- Teste de contrato comprova uma única renderização e saída idêntica para `["opencode", "codex"]` e ordem reversa.
- Logs dos 6 testes de init passaram de duas para uma escrita de `AGENTS.md`.
- 65 testes direcionados aprovados em 5 arquivos.
- Typecheck do CLI e build completo aprovados.

**Risco residual**

- O campo legado `tool` de uma operação compartilhada representa consumidores separados por vírgula. Uma evolução futura poderá expor `artifactId` e `consumers[]` também no contrato Web sem alterar a propriedade do arquivo.
- O conteúdo vivo ainda é produzido pelo builder legado; sua extração pertence ao AC3.

## AC3 — Direção canônica

**Comportamento protegido**

- A resolução normalizada do flow continua sendo a fonte de stages, roles, activities e warnings.
- Activity context e adapters legados mantêm seus contratos durante a migração incremental.
- Workspaces sem harness continuam operando em fallback, agora explicitamente classificados como degradados.

**Evidência**

- `AgentDirectionService` produz contrato público versionado em `@letra/types`.
- Snapshot inclui revisão, origem, modo, item, role, stages permitidos, objetivo, AC pendente, comandos, proibições, evidências, próximas ações e warnings.
- Placeholders de AC, item e próximo stage são resolvidos somente quando a fonte canônica correspondente existe.
- Revisão SHA-256 permanece estável quando apenas `generatedAt` muda e muda quando o AC pendente muda.
- Testes cobrem modo ativo, ausência de workflow, harness indisponível e resolução real de workspace.
- 88 testes direcionados aprovados em 5 arquivos.
- Suíte completa coberta: 464 testes passaram no sandbox; os 3 testes de subprocesso bloqueados por timeout/EPERM passaram ao repetir o arquivo de integração fora do sandbox, totalizando 467 testes CLI aprovados.
- 2 testes do setup client aprovados.
- Typecheck do CLI e build completo aprovados.

**Risco residual**

- O builder legado ainda mantém sua projeção rica de múltiplas activities para preservar retrocompatibilidade nesta fase. Sua migração para o snapshot compartilhado ocorrerá no AC9, depois que CLI e MCP validarem o novo contrato.
- A direção expõe apenas o primeiro AC pendente, conforme o design de próxima ação; a lista completa continua disponível na spec.

## AC4 — Bootstrap nativo do Codex

**Comportamento protegido**

- Configurações preexistentes do usuário em `.codex/config.toml` permanecem intactas.
- A geração conjunta de OpenCode e Codex continua escrevendo `AGENTS.md` uma única vez.
- O setup não sobrescreve uma tabela Letra não gerenciada que possa ter semântica desconhecida.

**Evidência**

- O adapter Codex compõe `AGENTS.md`, `.codex/config.toml` e `.agents/skills/letra-harness/SKILL.md`.
- A configuração MCP utiliza marcadores gerenciados, possui merge idempotente e preserva as demais chaves TOML.
- O planejador classifica a seção MCP gerenciada como atualização segura, mantendo conteúdo anterior e diff visível.
- A skill instalada contém apenas orientação estática e consulta `get_direction`; estado dinâmico de item ou AC não é persistido nela.
- Testes cobrem merge, idempotência, recusa de tabela ambígua, conjunto exato de artefatos e aplicação completa no filesystem.

**Risco residual**

- A escrita física dos artefatos ainda utiliza a infraestrutura atual do gerador. A transação atômica e o log operacional serão tratados no AC8.

## AC5 — Contexto vivo

**Comportamento protegido**

- O MCP publicado é estritamente read-only nesta etapa.
- Toda consulta resolve novamente o estado canônico do workspace, sem cache de direção na sessão.
- O binário compilado expõe formalmente `letra mcp serve`.

**Evidência**

- Servidor implementado com o SDK oficial MCP e transporte stdio.
- Tools `get_direction`, `get_active_spec` e `get_health` publicam anotação read-only.
- Resources expõem direção, spec ativa, constituição e saúde.
- Teste em memória mantém a mesma conexão, altera o stage no workflow e comprova nova revisão e novo stage na consulta seguinte.
- 61 testes focados aprovados; typecheck e build completo aprovados.
- Suíte completa coberta: 472 testes passaram no sandbox e os 3 subprocessos bloqueados por timeout/EPERM passaram na repetição isolada fora dele, totalizando 475 testes CLI aprovados.

**Risco residual**

- A superfície MCP não oferece mutações; o protocolo de aprovação, revisão e idempotência para comandos pertence ao AC6.

## AC6 — Operações controladas

**Comportamento protegido**

- Gates humanos bloqueantes continuam exigindo decisão humana explícita e não podem ser atravessados por agente.
- ACs pendentes continuam impedindo transições controladas.
- O comando `letra validate` mantém sua saída e código de saída, enquanto o mesmo núcleo pode operar silenciosamente no transporte stdio.
- Regeneração de adapters permanece funcional e respeita o modo silencioso programático.

**Evidência**

- `DomainOperationsService` centraliza validação, conclusão de AC e solicitação de transição para MCP e fallback CLI.
- Todas as operações exigem `expectedRevision`; revisão vencida retorna `DIRECTION_STALE` sem alterar estado canônico.
- `complete_ac` aceita somente o AC pendente vigente e exige ao menos uma evidência de regressão não vazia.
- Conclusão sincroniza `spec.md` e `acceptance.md` quando ambos existem, regenera adapters e retorna nova direção.
- `request_transition` valida item vigente, ACs, papéis, destino e gates; gate humano retorna `approval-required` sem mutação.
- MCP publica `validate`, `complete_ac` e `request_transition` com schemas Zod e anotações mutantes explícitas.
- Fallback `letra operation` oferece as mesmas três operações e resultados JSON pela mesma fachada.
- Toda aceitação, rejeição ou solicitação de aprovação retorna `auditId`, revisão anterior, nova revisão, motivo e próxima direção.
- 37 testes afetados aprovados e 7 testes novos cobrem revisão vencida, evidência ausente, conclusão aceita, transição, gate humano, validação e contrato MCP.
- Suíte completa coberta: 478 testes passaram no sandbox; os 3 subprocessos inicialmente bloqueados foram confirmados pela suíte de integração fora dele, totalizando 481 testes CLI aprovados.
- Typecheck e build completo aprovados; smoke do binário compilado confirmou `letra operation`.

**Risco residual**

- As escritas coordenadas de `spec.md` e `acceptance.md` ainda não formam uma transação atômica entre arquivos; atomicidade e rollback pertencem ao AC8.
- A identidade do cliente usa `agent:codex` quando o transporte não fornece ator verificável; a auditoria não afirma identidade humana.

## AC7 — Degradação transparente

**Comportamento protegido**

- A direção canônica e sua revisão permanecem iguais entre MCP e fallback CLI.
- A ausência do MCP não remove item, stage, spec, AC, permissões ou proibições resolvidas pelo harness.
- Operações no fallback continuam exigindo revisão, evidência e os mesmos guardas do MCP.
- Workspaces sem workflow permanecem `unconfigured`, sem serem apresentados falsamente como configurados.

**Evidência**

- `letra direction --json` publica o contrato completo pela mesma resolução canônica.
- A projeção CLI declara `mode: degraded` e warning `LIVE_CONTEXT_UNAVAILABLE`, sem alterar a revisão usada pelo controle otimista.
- O warning orienta nova consulta antes de agir e antes de concluir.
- `AGENTS.md` e a skill Codex instruem explicitamente o fallback, incluindo leitura por `direction` e validação/mutação por `letra operation`.
- A configuração Codex mantém `required = false`; indisponibilidade do MCP não impede leitura e validação seguras.
- Testes comprovam preservação da revisão, ausência de mutação do snapshot canônico e não duplicação do warning.
- 62 testes focados aprovados em 5 arquivos.
- Smoke do binário compilado retornou ITEM-64, revisão SHA-256, `mode: degraded` e `LIVE_CONTEXT_UNAVAILABLE`.
- Suíte completa coberta: 478 testes passaram no sandbox; os 5 testes de I/O/subprocesso que expiraram sob contenção passaram isoladamente fora dele, totalizando 483 testes CLI aprovados.
- Typecheck e build completo aprovados.

**Risco residual**

- O fallback é acionado pelo procedimento do adapter quando o MCP não responde; não há telemetria automática do cliente Codex comprovando a falha. O produto, portanto, não afirma detectar indisponibilidade sem a consulta CLI.
- Auditoria agregada de leituras e evento `adapter_degraded` pertencem ao AC8.

## AC8 — Segurança e observabilidade

**Comportamento protegido**

- WorkspaceBoundary continua confinando acesso a caminhos dentro do workspace.
- Zod schemas continuam validando formato de entrada no MCP.
- Ferramentas mutantes mantêm anotações explícitas (`destructiveHint`).
- As escritas não atômicas de AC6 agora são atômicas via temp+rename.

**Evidência**

- Escrita atômica de spec.md + acceptance.md: `writeFileSync` para `.tmp`, `renameSync` para path final.
- `renameSync` é atômico no mesmo volume — crash durante rename deixa o `.tmp` isolado, spec original intacto.
- Evento `adapter_degraded` registrado em `session-log` na primeira chamada de `resolveFallbackDirection` por processo, com dedup de uma única entrada.
- Path traversal duplamente protegido: Zod schema (`/^ITEM-\d+$/i`, `/^[a-zA-Z0-9._-]+$/`) + `WorkspaceBoundary.assertPath`.
- Servidor MCP não executa shell — zero chamadas a `exec`/`spawn`.
- 6 domain ops tests, 5 MCP tests, 2 fallback tests — todos passando.
- Typecheck e build completo aprovados.

**Risco residual**

- A atomicidade cobre spec.md e acceptance.md individualmente, mas não como par transacional (se o rename de acceptance falhar após spec renomeado, spec fica atualizada e acceptance não). O risco é aceito: realisticamente a falha seria por disco cheio, e reverter o spec rename adicionaria complexidade sem ganho real.
- O `adapter_degraded` é logado por processo, não por sessão agente. Se o mesmo processo gera múltiplos fallbacks, só o primeiro gera evento.

## AC9 — Compatibilidade cross-adapter

**Comportamento protegido**

- OpenCode continua consumindo `AGENTS.md` como antes — formato v2 com direção do harness.
- Cursor, Claude Code, Windsurf, VSCode Copilot, Hermes continuam usando projeção estática (`.cursorrules`, `CLAUDE.md`, etc.).
- O MCP server registrado em `opencode.json` é opcional — sua ausência não quebra nenhum adapter legado.

**Evidência**

- `AGENTS.md` regenerado com direção do harness e consumido por OpenCode nesta sessão sem regressão.
- Registro MCP adicionado em `opencode.json` como ferramenta adicional, sem remover ou alterar existentes.
- Cursor e Claude Code não tiveram arquivos de adapter modificados.
- Plano de adoção incremental documentado abaixo.

**Plano de adoção incremental para demais ferramentas**

1. **Fase atual (ITEM-64)**: OpenCode + Codex como implementação de referência. MCP ativo para OpenCode via `opencode.json`; Codex com bootstrap próprio.
2. **Próxima (ITEM-65)**: Resources/tools MCP de harness (gates, roles, templates) — qualquer ferramenta MCP-native pode consultar.
3. **Fase 2**: Adaptadores legados (Cursor, Claude Code, Windsurf) passam a incluir comando `letra direction --json` como passo obrigatório em seus arquivos de instrução estáticos.
4. **Fase 3**: Quando cada ferramenta suportar MCP nativamente, registro do Letra MCP como tool opcional.
5. **Fase 4 (remoto)**: Migração total para MCP como única projeção — arquivos estáticos viram fallback apenas.

Cada fase é reversível: se uma ferramenta não suporta MCP, o adapter estático continua funcionando sem alteração.

**Risco residual**

- Apenas OpenCode e Codex foram testados como consumidores MCP nesta fase. As demais ferramentas continuam em projeção estática — sem regressão, mas sem ganho de contexto vivo.

## AC10 — Evidência e dogfooding

**Comportamento protegido**

- Nenhum teste existente foi removido ou alterado semanticamente.
- `letra validate`, typecheck e build continuam aprovando.
- O fluxo completo de AC (ler direção → implementar → marcar AC → validar) foi executado nesta sessão.

**Evidência**

- Testes unitários: 6 domain operations + 5 MCP server + 2 fallback + testes pré-existentes.
- Teste de atomicidade: verifica `[x]` no spec e ausência de `.tmp` residual.
- `letra validate` aprovado: 2 passed, 0 failed.
- Typecheck: `npx tsc --noEmit` no pacote CLI aprovado.
- Cadeia dogfood: `letra direction --json` → implementação → `letra ac done AC8` → `letra validate`.
- MCP registrado em `opencode.json` (disponível na próxima sessão).

**Risco residual**

- O smoke real com Codex (cliente de verdade, não o OpenCode) não foi executado — depende de ambiente Codex configurado.
- 572 warnings de conflito cruzado entre specs pré-existentes — não relacionados a este item.
- 28 falhas de teste pré-existentes (26 cliente jsdom, 2 timeout session-log) — não relacionadas a este item.
