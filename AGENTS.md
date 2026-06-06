# Project Context — Letra

> Este arquivo é lido automaticamente pelo OpenCode ao iniciar uma sessão.
> Ele aponta para os arquivos oficiais de contexto e regras do projeto.

## Fontes da Verdade

- **Contexto Global**: [`.letra/context.md`](.letra/context.md) — Intent, domínio e restrições reais.
- **Constituição**: [`.letra/constitution.md`](.letra/constitution.md) — Regras não-negociáveis.
- **Glossário**: [`.letra/glossary.md`](.letra/glossary.md) — Linguagem ubíqua do projeto.
- **Specs Ativas**: Veja `.letra/specs/` para specs de features em desenvolvimento.

## Como Trabalhar Neste Projeto

1. **Antes de codar**: Sempre leia a spec relevante em `.letra/specs/<feature>/spec.md`.
2. **Validação**: Rode `letra lint` para checar formato das specs e `letra validate` para ver acceptance criteria.
3. **Constraints**: Siga a constituição. TypeScript estrito, specs thin, sem pseudo-código.
4. **Commits**: Mensagens concisas no padrão `tipo: descrição`. Ex: `feat: add validate smoke tests`.
5. **Teste local obrigatório antes de todo PR**: `npm run build` → `npm install -g .` → testar em temp dir. Só subir PR se o teste local passar.

## Regra de Comunicação

- **Primordial**: Toda comunicação deve ser em **pt-br**.
- **Fallback**: Se não for possível, use **inglês**.
- Aplica-se a mensagens de commit, respostas no chat, comentários e documentação.

## Detecção de Pergunta vs Comando

Quando o usuário **não** usar `?` no final, assuma que é uma **instrução** (faça).
Quando o usuário usar `?`, palavras interrogativas (`por que`, `como`, `qual`, `será que`), assuma que é uma **pergunta** (explique).
- Exceção: perguntas retóricas óbvias ainda devem ser tratadas como pergunta.

## Stack

- **Linguagem**: TypeScript (strict mode)
- **CLI**: Commander.js
- **Build**: tsup + pkg (binário standalone)
- **Testes**: Vitest
