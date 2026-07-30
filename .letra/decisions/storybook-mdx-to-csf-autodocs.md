# Storybook MDX to CSF Autodocs

## Contexto

O ITEM-76 exige que o catalogo visual do DS v2 seja fonte da verdade para humanos e agentes. O AC4 originalmente pedia MDX para Button, Badge, Card, Input, Dialog, Sheet, Select, Table, Toast e Tooltip.

Durante a migracao para Storybook 8.6 com React 19, o renderer MDX apresentou falhas de renderizacao para markup comum com filhos, enquanto CSF stories e autodocs funcionam de forma estavel na mesma stack.

## Alternativas

- Manter MDX como requisito estrito e bloquear o item ate resolver a stack.
- Fazer downgrade de React ou upgrade de Storybook para recuperar MDX.
- Usar CSF/autodocs como documentacao equivalente, com descricoes de uso/a11y, Controls, ArgsTable automatico e metadados `x-ds`.

## Escolha

Usar CSF/autodocs como equivalente funcional ao MDX para AC4 nesta stack.

## Justificativa

O objetivo do item e auditar e visualizar o DS, nao validar uma tecnologia especifica de documentacao. CSF/autodocs entrega a pagina de docs, controles, exemplos renderizados, metadados de catalogo e validacao CI sem introduzir downgrade, upgrade amplo ou workaround fragil.

MDX pode voltar a ser exigido em uma mudanca futura quando o renderer estiver compativel com a stack do repo.
