# Spec: diagnostics-hub

> Updated: 2026-06-23

## Outcome
O desenvolvedor visualiza, gerencia e corrige de forma rápida os alertas de integridade do repositório (drifts, conflitos de critérios, inconsistência terminológica) diretamente pela interface Web UI.

## Constraints
- Deve interagir de forma segura com a API `/api/diagnostics` e `/api/diagnostics/scan`.
- Os alertas devem permitir ações rápidas de Acknowledge (Ack) e Dismiss sem travar a navegação.

## Exclusions
- Auto-correções que mofidiquem código TypeScript do usuário sem confirmação explícita (somente correções na documentação e metadados).

## Acceptance Criteria
- [ ] **AC1**: Painel centralizado na Home/Header com a contagem de alertas ativos e histórico.
- [ ] **AC2**: Listagem detalhada de alertas exibindo: Tipo, Descrição, Severidade e Detector de origem.
- [ ] **AC3**: Botões de ação rápida (Ack/Dismiss) integrados a cada alerta para rodar os endpoints correspondentes.
- [ ] **AC4**: Visualizador de Diffs integrado quando o alerta for um drift de especificação/código.

## Context
Facilitar a resolução de problemas de integridade. Em vez de rodar repetidamente comandos CLI, a UI fornece uma visão direta e botões rápidos para auto-ajustes.
