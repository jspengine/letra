# Flow MVP — escopo enxuto, 3 comandos, valor imediato

**Date**: 2026-06-06
**Status**: accepted

## Context

O Letra v0.1.14 documenta intenção via specs mas não ajuda o usuário a definir e executar seu processo de trabalho. Discussão de discovery em 2026-06-06 identificou a necessidade de um sistema de workflow. A proposta inicial era ambiciosa: automações, skills engine, web UI, regras complexas. Análise crítica revelou que isso é overengineering para v0.2.

## Decision

Adotar escopo mínimo para Flow MVP com 3 comandos que geram valor imediato:

1. **`letra flow init --quick`** — wizard com 3 perguntas, gera workflow.json versionado
2. **`letra flow board`** — tabela no terminal com itens por estágio
3. **`letra flow move <id> --to <stage>`** — move item, regenera adapters automaticamente

Excluído do MVP (adiado para v0.3+):
- Automações complexas (webhooks, triggers condicionais) — n8n/Make resolvem
- Skills engine como conceito de primeira classe — descrição do agente basta
- Web UI (`letra flow ui`) — terminal + Mermaid cobre casos de uso iniciais
- Import de issues externas — manual via `backlog add` por enquanto

## Consequences

**Positivo:**
- Primeira entrega em dias, não semanas
- Cada comando vale por si só (valor fracionado)
- Menos risco de construir o que ninguém quer
- Fácil de pivotar baseado em feedback real

**Negativo:**
- Usuários avançados podem sentir falta de automações
- Modelo de dados inicial pode precisar de migration no futuro
- Sem web UI, adoção por não-devs é mais limitada
