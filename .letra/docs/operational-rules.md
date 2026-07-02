# Regras Operacionais — Letra

> Como executar builds, testes, releases e validações de forma segura e repetível.
> Complementa `.letra/constitution.md`. NÃO substitui regras de desenvolvimento.

## Como usar este documento

- Siga estes passos **na ordem** para preparar uma release.
- Qualquer desvio deve ser registrado como exceção e aprovado antes do merge.
- Este documento é **vivo**: atualize quando o processo mudar.

---

## 1. Ordem de execução (CI e local)

Sempre execute na ordem abaixo. Pare se qualquer passo falhar.

```bash
# 1. arquitetura
npm run architecture:check

# 2. tipos
npm run typecheck

# 3. testes unitários + cobertura
npm run test:core         # core
npm run test              # cli, detectors, adapters
npm run test:client       # (se mudar client/)

# 4. contratos e snapshots
npm run test:contracts

# 5. backward compat + migração
npm run test:backward-compat

# 6. integração multi-superfície
npm run test:integration

# 7. build
npm run build
```

---

## 2. Comandos e scripts

### architecture:check

Verifica:
- Nenhuma dependência cruzada inválida (`core` não importa `cli/api/mcp/client`).
- Nenhum módulo de `core` excede limite de linhas.
- Nenhuma função excede limite de linhas.

Em CI: falha o build se detectar violação.

### test:contracts

Cobre:
- JSON Schema validation de `workflow.json` e entidades principais.
- Snapshots de outputs estáveis (`letra flow board`, adapter outputs, `workflow.json` exemplo).
- Golden files em `tests/snapshots/`.

Regra de ouro: qualquer diff em snapshot é **regressão** e deve ser aprovada explicitamente (`--update-snapshots` apenas após revisão humana).

### test:backward-compat

Cobre:
- Migração de fixtures antigos (`tests/fixtures/backward-compat/`) para schema atual.
- Parsing de formatos antigos aceito pelo sistema atual.
- Backward compat como propriedade testável.

Fixtures:
- `tests/fixtures/backward-compat/workflow.v0.json`
- `tests/fixtures/backward-compat/workflow.v1.json`
- `tests/fixtures/backward-compat/focus.v0.md`

### test:integration

Para cada ação compartilhada (`claim`, `move`, `focus`, `health scan`, `validate`):
1. Executa via CLI (`letra flow ...`).
2. Executa via API (`curl http://localhost:3000/api/...` ou fetch em teste).
3. Executa via MCP (tool call em teste).
4. Compara estado final (`workflow.json`).

Os três caminhos devem produzir o mesmo estado final.

### test:regression

- Property-based testing (`fast-check`) com seed fixa.
- Cobra invariantes do domínio: ordenação de estágios, IDs únicos, consistência de `specLinks`, monotonicidade de `updatedAt`.

---

## 3. Fixtures e snapshots

Localização:
```
tests/
  fixtures/
    backward-compat/
      workflow.v0.json
      workflow.v1.json
      focus.v0.md
    contracts/
      workflow.minimal.json
      workflow.full.json
      item.minimal.json
      item.claimed.json
  snapshots/
    flow-board/
      empty.board.txt
      one-item.board.txt
      claimed-item.board.txt
    adapters/
      opencode.AGENTS.md
      hermes.instructions.md
```

Regras:
- Todo snapshot novo deve ser revisado antes de ser commitado.
- Nunca use `--update-snapshots` em batch. Atualize um por um, com descrição no commit.
- Snapshots são código: devem ser versionados, revisados e ter ownership claro.

---

## 4. CI gates (ordem obrigatória)

```yaml
# Antes de permitir merge / publish
- architecture:check
- typecheck         # por workspace
- test:core
- test
- test:contracts
- test:backward-compat
- test:integration (parcial ou full dependendo do escopo)
- build
```

Para PRs grandes (mudam `core/` ou `workflow.json`):
- Adicionar `test:regression` ao gate.
- Adicionar revisão arquitetural obrigatória (confere se hexagonal foi respeitada).

---

## 5. Staged rollout e feature flags

### Canary release

1. Bump versão **minor** com feature flag desligada por padrão: `"features": { "novaFuncionalidade": false }`.
2. Publique `@letra-ai/cli@next` e `@letra/core@next`.
3. Monitore por **7 dias** em uso real (beta testers ou dogfood interno).
4. Se estável, ligue a flag por padrão e publique como **minor** normal.
5. Se problema, desligue a flag e publique patch.

### Política de versionamento

| Tipo | Quando | Breaking? | Exigências |
|---|---|---|---|
| patch | fix, docs, chore | Não | testes passando |
| minor | feat, novo adapter | Não (backward compat) | test:contracts + test:backward-compat |
| major | breaking intencional | Sim | guia de migração + aviso prévio + release notes |

---

## 6. Processo de breaking change (quando major for necessária)

Apesar de minor/patch não permitirem breaking, às vezes um major é inevitável. Processo:

1. **Proposta**: abra issue/PR descrevendo o breaking, motivando e propondo migração.
2. **Pré-anúncio**: avise em changelog e canais com **2 semanas de antecedência**.
3. **Guia de migração**: documento com before/after, passo a passo, exemplos.
4. **Teste de migração**: fixture da versão antiga migrando para a nova SEM perder dados.
5. **Implementação**:altere código + testes + documentação.
6. **Release**: publique como major, destaque breaking nas release notes.

---

## 7. O que fazer quando um teste de regressão falhar

1. **Não atualize snapshots imediatamente.** Identifique se a mudança é intencional ou acidental.
2. Se for acidental: corrija o código.
3. Se for intencional: avalie impacto, documente o motivo, atualize snapshot com aprovação humana.
4. Nunca passe `--update-snapshots` em CI automática.

---

## 8. Responsabilidades

| Etapa | Responsável |
|---|---|
| architecture:check | autor do PR |
| typecheck/test | autor do PR |
| contratos + snapshots | autor do PR + revisor |
| backward-compat | autor do PR |
| breaking change | autor + tech lead |
| staged rollout | mantenedor + release manager |
