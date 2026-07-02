# Spec: logo-swap

> Updated: 2026-06-23

## Outcome
O logotipo do Letra no header do webapp será substituído pelo SVG oficial `logo-03-diamond.svg`, mantendo o layout e proporções atuais.

## Constraints
- SVG localizado em `.letra/brand/logo-03-diamond.svg`
- O SVG deve ser copiado para `packages/client/src/assets/` ou inline no componente Header
- Manter altura de 32px (h-8) e proporções atuais
- Não quebrar o layout do header (flex items-center)

## Exclusions
- Redesign do header (apenas troca do logo)
- Logotipo em adaptadores CLI (apenas webapp)

## Acceptance Criteria

- [x] **AC1**: O ícone "L" atual no Header (div com fundo amber + letra L) é substituído pelo SVG `logo-03-diamond.svg`. Altura 32px, proporção mantida via `viewBox`.
- [x] **AC2**: O texto "Letra." permanece ao lado do logo. O SVG pode ser inline (copiado para `packages/client/src/components/Header/LogoDiamond.tsx`) ou referenciado como asset import. Build compila sem erros.

## Context
O branding do Letra foi atualizado para o design diamond. O header atualmente usa um placeholder "L" em amber. A troca é puramente visual.
