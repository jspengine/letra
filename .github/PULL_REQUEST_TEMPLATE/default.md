## OBJETIVO

<!-- Resumo direto do que esta PR entrega. Máximo 3 linhas. -->
<!-- Ex: Adiciona validação de conflitos entre specs no `letra validate`. -->

## GANHOS

<!-- Quais problemas resolve ou oportunidades que desbloqueia. -->
<!-- Ex: 
- Elimina falsos positivos em PRs com specs conflitantes
- Reduz drift detection de 3 etapas manuais para 1 comando
-->

## PARA O REVISOR

**Tipo de mudança:**
- [ ] feature
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] test
- [ ] chore

**Spec vinculada:** `.letra/specs/[nome-da-spec]/spec.md`
<!-- Se não houver spec, apague esta linha. Toda feature nova deve ter spec. -->

**Checklist antes do merge:**
- [ ] `npm run lint` (zero erros)
- [ ] `npm run typecheck` (zero erros)
- [ ] `npm test` (verde)
- [ ] `letra validate` (verde)
- [ ] Acceptance criteria da spec marcados como `[x]`
- [ ] PR aponta para a branch correta (`development` ou `main`)

**Como testar:**
<!-- Comando ou passo a passo para validar a funcionalidade. -->
