# Spec: feature-cycle

> Updated: 2026-06-22

## Outcome

Um humano com uma ideia consegue transformá-la em funcionalidade pronta sem precisar gerenciar o agente em cada passo. O fluxo é:

```
IDÉIA → SPEC → BACKLOG → AGENTE EXECUTA → REVISÃO → DONE
  ↑human     ↑human      ↑human    ↑autônomo   ↑human   ↑human
```

O humano define **o quê** (spec + ACs). O agente executa **como** (código + validação + movimentação). O humano revisa e aprova. O ciclo se repete.

## Constraints

- Humano sempre cria a spec — agente nunca cria spec do zero
- Humano sempre revisa antes de fechar — agente nunca move direto para Done
- Agente pode mover entre estágios intermediários (Code → Review) sem aprovação
- Agente deve parar e pedir ajuda se: build quebra sem solução clara, decisão arquitetural complexa, ou AC ambíguo
- O ciclo funciona para OpenCode e Cursor — com diferenças de capacidade
- Cada item no workflow tem exatamente um humano responsável pela aprovação final
- Uma sessão de agente não precisa concluir o item inteiro — progresso parcial é registrado

## Exclusions

- Ciclo para outras ferramentas (Windsurf, Codex CLI, VSCode) — mesmo conceito, adaptar depois
- Execução automática do comando humano "Trabalhe no ITEM-N" — humano digita
- Aprovação automática de review — humano sempre revisa
- Specs geradas por IA — humano cria specs

## Acceptance Criteria

- [ ] **Seção no adapter OpenCode**: Instruções completas do ciclo com task(), todowrite(), bash()
- [ ] **Seção no adapter Cursor**: Instruções completas do ciclo com checkpoint a cada 2 ACs
- [ ] **Fase 1 — Entender**: pulse + ler spec + identificar ACs + criar plano
- [ ] **Fase 2 — Executar**: implementar → validate (+recovery) → pulse → sitrep → log → build (+recovery)
- [ ] **Fase 3 — Completar**: flow move --auto se todos ACs ✅, session-end, relato
- [ ] **Checkpoint no Cursor**: Instrução para pausar a cada 2 ACs em itens grandes
- [ ] **Sub-agentes no OpenCode**: Instrução para usar task() para ACs paralelos
- [ ] **Regras**: NUNCA criar spec, NUNCA mover para Done, NUNCA ignorar ACs, SEMPRE validar
- [ ] **Geração automática**: Seção gerada junto com adapters quando há item ativo
- [ ] **Sem item ativo**: Seção não aparece (sem ruído)
- [ ] **Registro no session-log**: Cada fase gera entradas no diário
- [ ] **Testes**: Seção OpenCode, seção Cursor, com/sem item ativo, checkpoint, sub-agentes

## Context

Este spec é o **fechamento de todo o sistema**. Os 12 specs anteriores definem o que o Letra oferece. Este spec define **como usar** em um ciclo completo humano + agente.

As diferenças entre OpenCode e Cursor refletem capacidades reais:
- OpenCode tem sub-agentes → ACs paralelos = mais rápido
- Cursor não tem → checkpoint = evita trabalho perdido

Ambos compartilham o núcleo: entender → implementar → validar → mover → relatar. A diferença está no paralelismo e checkpoint.
