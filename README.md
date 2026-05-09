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
# Inicializar um projeto com .letra/
letra init

# Criar uma nova spec
letra spec minha-feature

# Validar formato e completude das specs
letra lint

# Verificar acceptance criteria das specs
letra validate
```

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
| OpenCode | ✅ Completo | `.letra/adapters/opencode.json` |
| Cursor | ✅ Completo | `.cursorrules` |
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
