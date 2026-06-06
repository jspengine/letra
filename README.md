# Letra

> **Sua spec é a fonte da verdade.**

Letra é um framework de **Specification-Driven Development (SDD) agnóstico a ferramentas**. Captura direção, intenção e contexto, enriquecendo prompts de agentes de código — funcionando como uma **memória persistente** do projeto.

## O Problema

- **Spec-Code Drift**: Especificações ficam desatualizadas conforme o código evolui.
- **Markdown Madness**: Specs de 50k+ tokens que ninguém lê.
- **Perda de Contexto**: Decisões vivem só no histórico do chat.
- **Tool Lock-in**: Ferramentas presas a um IDE ou modelo específico.
- **Agentes ignoram specs**: Seguem 70-90% e não dá pra ver o que faltou.

## A Solução

- **Thin Specs**: Máximo 1 página por feature.
- **Spec-Anchored**: Spec vive junto com o código, atualizada como parte do DoD.
- **Context First**: Intent, constraints e "porquês" — não markdown verbose.
- **Agnóstico**: Adapters para OpenCode, Cursor, VS Code e mais.

## Instalação

```bash
# Execução direta via npx
npx @letra-ai/cli init meu-projeto

# Ou instalação global
npm install -g @letra-ai/cli
```

## Uso

```bash
# Inicializar um projeto com .letra/ (modo interativo)
letra init

# Silent mode (usa defaults, sem perguntas)
letra init --yes

# Criar uma nova spec
letra spec minha-feature

# Criar spec com template específico
letra spec minha-feature --template web-api
letra spec minha-feature --template cli-tool

# Validar formato e completude das specs
letra lint

# Verificar acceptance criteria das specs
letra validate
letra validate --format github-annotation  # formato para CI (GitHub Actions)
letra validate --format junit               # formato XML (demais CIs)
letra validate --watch                      # re-valida automaticamente ao salvar

# Combinar flags
letra validate --watch --format github-annotation

# Registrar decisão arquitetural
letra decision new "Usar Commander em vez de Yargs"
letra decision list

# Definir foco da sessão
letra focus validate-conflict
letra focus                          # ver foco atual
letra focus --clear                  # limpar foco

# Gerenciar workflow (Flow MVP)
letra flow init --quick              # wizard 3 perguntas
letra flow backlog add "Descrição"   # adicionar item ao backlog
letra flow backlog list              # listar todos os itens
letra flow move ITEM-1 --to Code     # mover item por ID
letra flow move "Descrição" --to Review  # mover por descrição
letra flow board                     # board visual por estágio
```

## Validação de Specs

O `letra validate` analisa automaticamente suas specs em busca de problemas comuns. São 7 verificações que rodam em toda spec:

| Verificação | O que ela pega | Exemplo real |
|---|---|---|
| **Seções Vazias** | Seções que ficaram com o texto do template ou quase vazias | Você cria uma spec, copia o template, esquece de preencher o "Outcome". A verificação avisa que aquela seção ainda tem o texto padrão. |
| **Conteúdo Mínimo** | Outcome muito curto, sem detalhe do que será feito | Escrever "Fazer o login" como Outcome não descreve o suficiente. A verificação sugere expandir. |
| **ACs sem Métrica** | Critérios de aceite vagos, que não dá pra saber se passaram ou falharam | Escrever "Melhorar a performance" não é mensurável. O certo seria "Tempo de resposta < 200ms". |
| **Consistência de Terminologia** | Termos definidos no glossário que não foram usados na spec | O glossário define "JWT" mas a spec chama de "token mágico". A verificação alerta para usar o termo oficial. |
| **Detecção de Tom** | Gírias e linguagem informal em specs que deveriam ser formais | Escrever "blz" ou "tipo" numa spec que descreve um sistema crítico. |
| **Baixa Confiança** | Palavras que mostram incerteza sobre o que está sendo especificado | "O sistema **provavelmente** valida o token" — não tem "provavelmente" numa especificação. É tudo certo ou não é. |
| **Drift Temporal** | Specs que não são atualizadas há mais de 30 dias | A spec de autenticação foi escrita em janeiro, mas o código foi alterado em maio. A verificação alerta que a spec pode estar desatualizada. |

## Funcionalidades Avançadas

### Init Interativo

`letra init` agora pergunta o tipo de projeto (web app, CLI, library, mobile) e qual agente IA você usa, adaptando os arquivos gerados. Use `--yes` para pular as perguntas.

### Templates por Domínio

`letra spec <nome> --template <nome>` cria specs com estrutura pré-definida para cada domínio:

| Template | Quando usar |
|----------|-------------|
| `web-api` | Endpoints REST, GraphQL, websockets |
| `cli-tool` | Comandos, argumentos, exit codes |
| `mobile-feature` | Telas, navegação, estados |
| *custom* | Coloque arquivos `.md` em `.letra/templates/` |

### Formatos de Output

`letra validate --format <formato>` permite integrar com diferentes CIs:

- `text` (default) — saída colorida para terminal
- `github-annotation` — `::error`/`::warning` compatível com GitHub Actions
- `junit` — XML padrão para demais ferramentas de CI

### Watch Mode

`letra validate --watch` monitora alterações em specs e re-executa validação automaticamente com debounce de 300ms.

### Architecture Decision Records

`letra decision new <título>` cria ADRs em `.letra/decisions/` com template Contexto → Decisão → Consequências, data automática e status `proposed`. `letra decision list` lista todos os ADRs.

### Flow — Gerenciamento de Workflow (MVP)

`letra flow` gerencia seu processo de trabalho com estágios, itens e adapters que mantêm agentes de IA sincronizados com o contexto atual.

```bash
letra flow init --quick
# → Wizard com 3 perguntas (nome, estágios, ferramentas)
# → Gera .letra/workflow.json com versão 1.0

letra flow backlog add "Implementar login"
# → Adiciona ITEM-1 ao primeiro estágio (Backlog)
# → IDs auto-incrementais: ITEM-1, ITEM-2, ITEM-3...

letra flow backlog list
# → Tabela com ID, descrição, estágio e idade de todos os itens

letra flow move ITEM-1 --to Code
letra flow move "Implementar login" --to Review
# → Move entre estágios por ID ou descrição
# → Regenera automaticamente AGENTS.md, .cursorrules, etc.
# → Adapters refletem estágio atual e itens ativos

letra flow board
# → Board visual: estágios, contagem de itens, itens ativos
# → Estágios vazios marcados como (empty)
```

### Session Focus

`letra focus <spec>` define qual spec está ativa na sessão atual, escrevendo `.letra/focus.md`. O adapter do `letra init` já referencia esse arquivo, então o agente sabe exatamente o que importa agora. Use `letra focus` para ver o foco atual e `letra focus --clear` para limpar.

### Validação de Conflitos entre Specs

A 8ª heurística do `letra validate` — detecta automaticamente ACs contraditórios entre specs diferentes (ex: "login com email" vs "login apenas com Google"), evitando que requisitos conflitantes virem bugs. Severidade configurável via `config.json`.

## Estrutura de Memória

```
.letra/
├── context.md              # Intent global, domínio, restrições reais
├── constitution.md          # Regras não-negociáveis
├── glossary.md              # Termos do domínio
├── lessons-learned.md       # Erros recorrentes dos agentes
├── decisions/               # ADRs
├── specs/
│   └── minha-feature/
│       ├── spec.md          # O que + porquê (1 página max)
│       ├── acceptance.md    # Critérios binários
│       └── status.md        # Sync status
└── adapters/
    └── opencode.json        # Configuração do adapter OpenCode
```

## Adapters

| Adapter | Status | Artefato Gerado |
|---------|--------|----------------|
| OpenCode | ✅ Completo | `AGENTS.md` |
| Codex CLI | ✅ Completo | `AGENTS.md` (compartilhado) |
| Claude Code | ✅ Completo | `CLAUDE.md` |
| Cursor | ✅ Completo | `.cursorrules` |
| Windsurf | ✅ Completo | `.windsurfrules` |
| VS Code (Copilot) | ✅ Completo | `.github/copilot-instructions.md` + `.vscode/settings.json` |

## Exemplo

```bash
# Criar um novo projeto
mkdir meu-app
cd meu-app

# Inicializar o .letra/
npx @letra-ai/cli init

# Criar uma spec de autenticação
npx @letra-ai/cli spec auth

# Editar .letra/specs/auth/spec.md com sua intenção
# Desenvolver a funcionalidade...

# Validar se o código cumpre os acceptance criteria
npx @letra-ai/cli validate

# Ou usar o Flow para gerenciar o processo
npx @letra-ai/cli flow init --quick
npx @letra-ai/cli flow backlog add "Tela de login"
npx @letra-ai/cli flow move ITEM-1 --to Code
npx @letra-ai/cli flow move ITEM-1 --to Review
npx @letra-ai/cli flow board
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em dev
npm run dev

# Lint e formatação
npm run lint

# Type check
npm run typecheck

# Build
npm run build

# Testes
npm test
```

## Licença

MIT
