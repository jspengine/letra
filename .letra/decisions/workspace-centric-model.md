# Workspace-Centric Model — Requisitos e Arquitetura

**Data:** 2026-06-21  
**Status:** Aceito  
**Autores:** discussão + refinamento Hermes/Letra  
**Contexto:** O modelo original (1 projeto → N repositórios) não representa o caso de uso real de engenheiros que trabalham com soluções transversais a múltiplos domínios/repositórios.

---

## 1. Problema que estamos resolvendo

Usuários de Letra são engenheiros de software que:
- Trabalham com arquitetura de microserviços (cada time owns seu repo).
- Precisam implementar uma solução que atravessa múltiplos repositórios.
- Querem que o Letra entenda o *contexto da solução*, não repositórios isolados.
- Têm vários contextos de trabalho simultâneos (PIX no crédito,重构 de auth, etc).

O modelo antigo (`Project` como unidade raiz) forçava o usuário a pensar por repositório, não por solução. Isso não escala.

---

## 2. Mudança conceitual

### Antes
```
Project (1)
  └─ Repositories (N)
```
- Unidade de valor: projeto individual
- Harness por projeto
- Descoberta por projeto

### Agora
```
Workspace (1) — "Adicionar PIX no sistema de créditos"
  └─ Repositories / Pastas (N) — creditos-api, pix-gateway, shared-lib
```
- Unidade de valor: **workspace** (solução em andamento)
- Harness por workspace
- Usuário pode ter **vários workspaces simultâneos**
- Cada workspace agrega os repositórios/pastas que compõem aquela solução

**Terminologia oficial:**
- `workspace`: espaço de trabalho = solução em andamento
- `repository ref`: referência a um repositório/pasta local vinculado ao workspace
- `harness`: template de fluxo + regras gerado/versionado por workspace

---

## 3. Caso de uso real (cenário canônico)

**Usuário:** Engenheiro de software  
**Tarefa:** Adicionar método de pagamento PIX no sistema de créditos

**Passos com Letra:**
1. Baixa/clona os repositórios localmente:
   - `~/code/creditos-api`
   - `~/code/pix-gateway`
   - `~/code/bb-shared`
2. Executa `letra workspace create "PIX crédito"`
3. No wizard, **seleciona os diretórios locais** (file picker/checkboxes, não digita path)
4. Letra cria o workspace, detecta os repositórios, gera o harness SDLC
5. Usuário executa `letra flow start` e o Letra guia o fluxo (spec → code → review → PR)
6. Cada etapa opera sobre os repositórios vinculados, em语境 compartilhado

**Comportamento desejado:** Letra entende que `creditos-api` e `pix-gateway` fazem parte da mesma solução.

---

## 4. Modelo de dados canônico

### 4.1 `workspace.yaml` (estrutura oficial)

```yaml
# ~/.letra/workspace/pix-credito/workspace.yaml
id: pix-credito
name: "Adicionar PIX no sistema de créditos"
created: 2026-06-21
template: sdlc
gates:
  - spec-review
  - code-review
repositories:
  - id: creditos-api
    path: ~/code/creditos-api
    branch: main
    detectedType: git
  - id: pix-gateway
    path: ~/code/pix-gateway
    branch: main
    detectedType: git
  - id: bb-shared
    path: ~/code/bb-shared
    branch: main
    detectedType: git
harness:
  version: v0.1.0
  path: ~/.letra/harness/v0.1.0/
flow:
  instanceId: flw-20260621-01
  currentStage: spec-draft
  status: active
```

### 4.2 `letra.link` (opcional, em cada repositório)

```json
// ./creditos-api/letra.link
{
  "workspace": "pix-credito",
  "repositoryId": "creditos-api"
}
```
- Arquivo mínimo para detected reverso (workspace → repositório).
- Pode ser symlink ou arquivo JSON simples.
- **Não é obrigatório** para o funcionamento; serve como validação/descoberta reversa.

### 4.3 Diretório global do Letra

```
~/.letra/
├── workspace/
│   ├── pix-credito/
│   │   ├── workspace.yaml
│   │   └── flows/
│   │       └── sdlc.json
│   └── auth-redesign/
│       └── workspace.yaml
├── harness/
│   └── v0.1.0/
│       └── flows/
│           └── sdlc.yaml
├── index.yaml            # índice de workspaces (opcional p/ performance)
└── config.yaml           # config global (telemetry, workspace root custom)
```

---

## 5. Comandos CLI (catalogo oficial)

| Comando | Função |
|---------|--------|
| `letra` (sem args) | Dashboard lista workspaces + status |
| `letra workspace create <nome>` | Cria workspace (wizard interativo se faltarem flags) |
| `letra workspace list` | Lista todos os workspaces |
| `letra workspace switch <id>` | Ativa workspace (contexto para comandos seguintes) |
| `letra workspace delete <id>` | Remove workspace (mantém repositórios intactos) |
| `letra flow start` | Inicia fluxo SDLC no workspace ativo |
| `letra flow status` | Mostra estágio atual + gates pendentes |
| `letra flow next` | Avança estágio (respeitando gates) |
| `letra review` | TUI interativa para revisão de código |
| `letra pr` | Cria PR com descrição gerada do fluxo |
| `letra sync` | Atualiza harness do workspace ativo |
| `letra metrics` | Mostra métricas do workspace ativo |

---

## 6. Jornada do usuário (refinada)

### 6.1 Primeira execução

```bash
letra workspace create "PIX crédito"
```

**Wizard (TUI优先):**
1. **Nome** → `pix-credito`
2. **Selecionar pastas** → file picker/checkboxes a partir de diretórios comuns (`~/code/`, `~/dev/`, `C:/workspace/`)
3. **Template** → SDLC (default)
4. **Gates** → Spec Review, Code Review (default)
5. **Preview** → árvore de diretórios + resumo
6. **Aplicar** → workspace criado, harness clonado

**Alternativa sem interação:**
```bash
letra workspace create "PIX crédito" \
  --path ~/code/creditos-api \
  --path ~/code/pix-gateway \
  --path ~/code/bb-shared \
  --template sdlc \
  --gate spec-review \
  --gate code-review
```

### 6.2 Uso diário

```bash
# Ativar contexto
letra workspace switch pix-credito

# Iniciar fluxo
letra flow start

# Trabalhar normalmente (git, code, commit)
# Quando pronto para revisão:
letra review
# → TUI: diff + checklist + comentários

# Quando aprovado:
letra pr
# → PR criado com descrição gerada do fluxo
```

---

## 7. Arquitetura hexagonal ajustada

### 7.1 Entidades do Core

```
Workspace (aggregate root)
  ├─ id: string
  ├─ name: string
  ├─ repositories: RepositoryRef[]
  │    ├─ id: string
  │    ├─ path: string
  │    ├─ branch: string
  │    └─ detectedType: 'git' | 'plain'
  ├─ harness: HarnessRef
  │    ├─ version: string
  │    └─ path: string
  ├─ flow: FlowInstance?
  │    ├─ instanceId: string
  │    ├─ currentStage: string
  │    └─ status: 'active' | 'paused' | 'done'
  └─ gates: string[]
```

### 7.2 Portos (interfaces)

| Port | Responsabilidade |
|------|-----------------|
| `WorkspaceRepository` | CRUD de workspaces (persistência) |
| `RepositoryDiscovery` | Lista diretórios locais, detecta tipo git/non-git |
| `HarnessSynchronizer` | Clona/atualiza harness versionado |
| `FlowEngine` | Avança stages, valida gates, coleta métricas |
| `GitOperator` | Opera git dentro de cada repositório (branch, diff, PR) |

### 7.3 Adaptadores

| Adapter | Stack | Função |
|---------|-------|--------|
| `CliAdapter` | Commander + Ink | Interface texto e TUI |
| `FilesystemAdapter` | Node fs/path | Leitura/escrita de workspace.yaml e flows |
| `GitAdapter` | simple-git | Operações git |
| `WebAdapter` | Vite + React | SPA standalone (`packages/client`) |

### 7.4 Regras do Hexágono (atualizadas)

1. **Core não importa superfícies.** `Workspace`, `FlowInstance`, `RepositoryRef` são puros.
2. **Thin wrappers ≤ 100 linhas.** Cada comando CLI é um wrapper que chama uma porta.
3. **Comportamento implementado uma vez no core.** Stages, gates, métricas vivem no core.
4. **Harness é imutável por tag.** Workspace referenceia uma versão; não regenera por fase.

---

## 8. Requisitos não-funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | Workspace root padrão: `~/.letra/workspace/`. Customizável via `LETRA_WORKSPACE` env. |
| RNF-02 | Harness versionado por semver, armazenado em `~/.letra/harness/<version>/`. |
| RNF-03 | Descoberta de repositórios locais: mínimo 1 diretório selecionado. |
| RNF-04 | `letra.link` é opcional; workspace funciona sem ele. |
| RNF-05 | TUI fallback automático para `--plain` se `TERM` não suportar Ink. |
| RNF-06 | Métricas coletadas por hook em transições de stage (append-only). |
| RNF-07 | Concorrência: lock otimista via hash do workspace.yaml. |
| RNF-08 | CLI e Client (SPA) são pacotes independentes. SPA não embarcada. |

---

## 9. Decisões tomadas (ADR resumido)

| # | Decisão | Status |
|---|---------|--------|
| ADR-01 | Unidade de valor é **Workspace**, não Project | Aceito |
| ADR-02 | Workspace contém N repositórios/pastas | Aceito |
| ADR-03 | Harness versionado por tag, imutável | Aceito |
| ADR-04 | SPA não embarcada no CLI | Aceito |
| ADR-05 | File picker para seleção de diretórios (não input manual de path) | Aceito |
| ADR-06 | Wizard TUI优先, com fallback flag-based para CI | Aceito |
| ADR-07 | Flow Phases (máquina aninhada) adiado para Fase 3+ | Aceito |
| ADR-08 | 4 métricas core em v1 (cycle_time, review_wait, rejection_rate, throughput) | Aceito |
| ADR-09 | Sem fallback `.letra/` local em v1 | Aceito |
| ADR-10 | `letra.link` arquivo opcional em repositórios vinculados | Aceito |

---

## 10. Próximos passos

1. Revisão e aprovação deste documento.
2. Atualização dos mockups (wizard com file picker, terminologia workspace).
3. Definição detalhada dos schemas (`workspace.yaml`, `letra.link`).
4. Início da Fase 0: workspace discovery + `letra init`.
