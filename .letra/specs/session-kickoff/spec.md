# Spec: session-kickoff

> Updated: 2026-06-22

## Outcome

Quando um agente (OpenCode, Cursor, Claude Code, Windsurf) inicia uma sessão no workspace, ele não precisa adivinhar por onde começar. Uma seção "Checklist de Início" no adaptador instrui exatamente: leia o pulse, verifique alertas, identifique o item atual, leia o context.md, e prossiga.

A primeira ação do agente é sempre a mesma independente da ferramenta. O humano não precisa repetir instruções.

## Constraints

- Seção aparece sempre que o workspace tem workflow inicializado
- Máximo 10 linhas no adaptador — concisa, direta
- Passos são checkboxes mentais, não acionáveis via clique
- Ordem importa: pulse → alertas → contexto → item
- Se não há item ativo, o último passo instrui a pegar do backlog
- A seção é gerada automaticamente junto com os adaptadores
- Não depende de health-record existir — funciona sem

## Exclusions

- Instruções específicas por tipo de tarefa (bug, feature, refactor) — sempre o mesmo protocolo
- Execução automática dos passos — agente decide se e como executar
- Tutorial de como usar a ferramenta (OpenCode/Cursor) — só os passos Letra

## Acceptance Criteria

- [ ] **Seção "Checklist de Início"**: Aparece no adaptador quando workflow existe
- [ ] **5 passos**: pulse → alertas → contexto → item → mão na massa
- [ ] **Sem item ativo**: Último passo instrui a pegar do backlog com comandos
- [ ] **Com item ativo**: Último passo instrui a trabalhar no item
- [ ] **Ordem correta no adaptador**: Após Pendências Detectadas e antes de Handoff
- [ ] **Concisa**: Máximo 10 linhas
- [ ] **Sem dependência**: Funciona sem health-record, sem situation-room
- [ ] **Regeneração automática**: Atualizada quando adapters são gerados
- [ ] **Testes**: Seção com item ativo, sem item ativo, sem health-record

## Context

Este spec fecha o último gap do ciclo agêntico: a primeira ação. Antes, o agente chegava e não sabia por onde começar. Agora tem um checklist explícito: pulse → alertas → contexto → item → trabalhar.

A ordem no adaptador segue uma progressão de leitura natural:
1. Quem sou (Identidade)
2. O que está rolando (Workflow + Foco)
3. O que está errado (Alertas)
4. Por onde começar (Checklist)
5. Quais ferramentas (Comandos)
6. O que fazer depois (Handoff)
