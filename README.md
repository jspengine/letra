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
- **Agnóstico**: Adapters para OpenCode, Cursor, VS Code, e mais.

## Instalação

```bash
# Via npm
npm install -g @letra/cli

# Ou baixe o binário standalone
# (para usuários sem Node.js instalado)
```

## Uso

```bash
# Inicializar um projeto com .letra/
letra init

# Criar uma nova spec
letra spec new feature-auth

# Validar formato das specs
letra lint

# Verificar acceptance criteria
letra validate
```

## Estrutura de Memória

```
.letra/
├── context.md          # Intent global, domínio, restrições reais
├── constitution.md     # Regras não-negociáveis
├── decisions/          # ADRs
├── specs/
│   ├── feature-auth/
│   │   ├── spec.md             # O que + porquê (1 página max)
│   │   ├── acceptance.md       # Critérios binários
│   │   └── status.md           # Sync status
├── lessons-learned.md  # Erros recorrentes dos agentes
├── glossary.md         # Termos do domínio
└── adapters/
    ├── opencode.json   # Como OpenCode injeta contexto
    ├── cursor.json
    └── vscode.json
```

## Adapters

| Adapter | Status |
|---------|--------|
| OpenCode | Em desenvolvimento |
| Cursor | Planejado |
| VS Code | Planejado |

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em dev
npm run dev

# Build
npm run build

# Testes
npm test
```

## Licença

MIT
