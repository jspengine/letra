# UX Design — Release Readiness

> Updated: 2026-07-10

## Problem Statement

O Letra promete supervisão confiável de trabalho assistido por IA, mas a experiência atual ainda mistura módulos técnicos, taxonomia histórica e padrões visuais parcialmente fora do design system. Isso dilui a proposta do produto e aumenta a carga cognitiva do supervisor.

## Product Promise To Preserve

O produto deve responder com clareza:

1. O que precisa da minha decisão?
2. O que está acontecendo agora?
3. O que está sendo construído?
4. Quais regras governam este trabalho?
5. Onde estão as evidências?

## Key Findings

### 1. A navegação primária ainda não segue a intenção do usuário

Hoje a navegação expõe `Dashboard`, `Agentes`, `Discovery`, `Design`, `Specifications`, `Quadro` e `Auditoria`. A release precisa convergir para uma arquitetura por intenção:

- `Supervisão`
- `Trabalho`
- `Conhecimento e Regras`
- `Atividade`

`Workspace` permanece como contexto global e porta de entrada quando não existe seleção ativa.

### 2. O produto ainda comunica estrutura interna demais

O usuário supervisor não deveria precisar entender a diferença entre telas herdadas como `Dashboard`, `Execution`, `Knowledge`, `Audit` e `Agents` para executar sua tarefa. Essas áreas podem continuar existindo tecnicamente, mas devem ser reposicionadas segundo o propósito operacional.

### 3. O design system ainda não governa o client inteiro

O `packages/client` ainda mistura:

- componentes de `@letra/ui`
- aliases shadcn locais em `packages/client/components.json`
- estilos inline espalhados
- tokens legados e aliases de compatibilidade

A transição precisa fazer o DS governar shell, tokens, semântica visual e estados das jornadas críticas.

### 4. Existem controles e affordances que enfraquecem confiança

Exemplos observados no client:

- placeholder `Em desenvolvimento`
- callback inerte em `HomeView`
- destinos marcados como `disabled`
- ações visíveis com fluxo incompleto

Esses pontos violam a promessa de verdade operacional e devem sair do caminho crítico da release.

## UX Principles For The Transition

### Linguagem honesta

Nenhuma label, status ou CTA pode sugerir automação, execução, agente ativo ou decisão persistida se o estado real não sustenta essa afirmação.

### Supervisão antes de operação

A interface deve priorizar decidir, entender, revisar e inspecionar. Operações estruturais e administrativas não podem competir visualmente com o que exige atenção humana imediata.

### Evidência sempre acessível

Toda jornada principal precisa apontar para a evidência correspondente com baixo atrito: item, spec, decisão, regra, log ou alerta.

### Redução de taxonomia interna

O usuário deve navegar por perguntas e intenções, não por nomes de módulos ou artefatos técnicos.

### DS como base obrigatória

O trabalho de transição precisa reduzir estilos inline, aliases legados e semântica duplicada, aproximando o client de @letra/ui.

Se um padrão ou componente ainda não existir, a ordem obrigatória é:

1. definir o componente no catálogo do design system
2. documentar sua anatomia, estados e tokens
3. publicar/expôr em @letra/ui
4. só então adotar o componente no app

## Target Information Architecture

## Primary Navigation

- `Supervisão`
- `Trabalho`
- `Conhecimento e Regras`
- `Atividade`

## Global Context

No cabeçalho:

- workspace ativo
- diretório/escopo atual
- saúde resumida
- decisões pendentes
- acesso rápido a diagnósticos e histórico observável

## Secondary Or Embedded Surfaces

- `Workspace` como gate/entrada quando não existe workspace ativo
- `Specs` dentro de `Conhecimento e Regras`
- `Harness` dentro de `Conhecimento e Regras`
- `Papéis/Atores` como aprofundamento de `Atividade` ou `Conhecimento e Regras`
- configuração estrutural de stages/webhooks fora do plano principal de `Trabalho`

## Release Scope

## Must Have For Release

- entrada padrão orientada à supervisão
- navegação primária consolidada
- remoção de destinos inertes ou desabilitados do primeiro plano
- board tratado como jornada de trabalho supervisionado
- auditoria apresentada como atividade investigativa
- contexto, regras e specs consolidados como área única de governança
- uso mais consistente do DS nas superfícies críticas

## Can Wait After Release

- refatoração completa de todos os estilos inline
- redesign profundo de patterns menos críticos
- expansão da área de agentes/papéis
- unificação total de diagnósticos com supervisão avançada
- limpeza completa dos aliases legados em todas as superfícies secundárias

## Risks

- Refatorar navegação sem reposicionar conteúdo pode apenas renomear o problema.
- Refatorar visual sem consolidar jornadas mantém a dívida de produto.
- Levar administração do flow junto da jornada de trabalho principal aumenta a complexidade da release.

## Decision

Antes de qualquer implementação grande, a release de UX deve ser guiada por quatro jornadas principais, uma arquitetura de informação estável e um plano incremental de transição. A UI deve comunicar supervisão confiável, não coleção de módulos.

