# Amber Rebrand Accessibility Audit

**Item**: `ITEM-36`
**Date**: 2026-06-30
**Status**: Static checks passed; live visual inspection pending

## Checks completed

- document language changed to `pt-BR`
- dark theme is the default unless the user or operating system prefers light
- global visible focus uses a 2px primary outline
- Kanban cards are reachable by Tab and open with Enter or Space
- SSE workflow and diagnostic updates use an `aria-live="polite"` region
- redundant agent initials are hidden from assistive technology
- reduced-motion preferences disable non-essential animation
- the document editor stacks on small screens and splits at the desktop breakpoint

## Contrast evidence

Contrast was calculated from the OKLCH tokens after conversion to linear sRGB.

| Pair | Ratio | Result |
|---|---:|---|
| light primary / dark foreground | 7.80:1 | pass |
| dark primary / dark foreground | 9.66:1 | pass |
| light muted text / white background | 4.73:1 | pass |
| dark muted text / dark background | 7.63:1 | pass |
| light text link / white background | 4.89:1 | pass |
| error / white foreground | 4.76:1 | pass |

The previous light primary / white foreground ratio was 2.54:1 and was corrected.

## Automated evidence

- `DocumentEditor`: 6 tests passed
- TypeScript typecheck: passed
- production build: passed

## Pending manual evidence

The in-app browser refused the local page reload under its URL security policy.
The final visual inspection must confirm Home, Specs, Flow and Context at:

- desktop: width at least 1280px
- tablet: width from 768px to 1279px
- mobile: width below 768px

This pending inspection prevents AC14 from being marked complete automatically.
