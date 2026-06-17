# Spec: Fix Dead-Icons Detector

> Updated: 2026-06-15

## Outcome

O detector dead-icons existente tem dois bugs que impedem auto-correções corretas. Corrigir ambos para que o detector funcione conforme o especificado em self-diagnosis-core.

> **Dev-only**: Este detector só faz sentido no repositório do Letra (dogfooding). Projetos de usuário final não têm um `ICONS` map — o detector nunca produz resultados para eles. Implementado via `devOnly: true` no objeto do detector.

## Constraints

- O placeholder de ícone ausente deve ser `string[]` com paths SVG reais (fallback), não `() => JSX.Element`
- `ICON_DEF_PATTERN` deve reconhecer definições existentes no formato `"nome": [...]` (colchetes)
- Testes existentes devem continuar passando

## Acceptance Criteria

- [x] **Placeholder string[]**: `dead-icons.ts` autoFix adiciona `"iconName": ["M12..."]` em vez de `"iconName": () => <svg...>`
- [x] **ICON_DEF_PATTERN corrigido**: Regex muda de `\(` para `\[` para capturar definições no ICONS map; também suporta nomes com e sem aspas
- [x] **Teste de formato**: Teste verifica que autoFix adiciona placeholder no formato `string[]` e o build não quebra
- [x] **Snapshot de rollback**: Se autoFix rodou antes do bug, undo restaura o arquivo ao estado anterior (já coberto pelo engine)

## Exclusions

- Revisão de outros detectores — escopo limitado ao dead-icons
- Mudança na estrutura do ICONS map (continua `Record<string, string[]>`)

## Context

Bug descoberto durante sessão de auto-diagnóstico. O detector adicionava placeholders como `() => JSX.Element` porque o desenvolvedor original copiou o formato errado. O ICONS map espera `string[]` (paths SVG), o que quebrava o build se o autoFix fosse aplicado.
