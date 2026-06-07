# Glossary

> Termos do domínio e linguagem ubíqua do projeto Letra

| Termo | Definição |
|-------|-----------|
| **Spec** | Especificação thin que define o que deve ser construído (Outcome + Constraints + Exclusions + Acceptance Criteria). |
| **Drift** | Divergência entre o que a spec diz e o que o artefato realmente entrega. |
| **Adapter** | Tradutor que converte `.letra/` para o formato que uma IDE/agent entende. |
| **Context** | Documento que captura intent, domínio, restrições reais e "porquês" do projeto. |
| **Constitution** | Regras não-negociáveis de arquitetura, código e workflow. |
| **Thin Spec** | Spec de no máximo 1 página, focada em outcome, não em implementação. |
| **Validation Gate** | Gate de CI/CD que bloqueia merge se a spec não for cumprida. |
| **Spec-Anchored** | Modelo onde a spec vive junto com o código e é atualizada como parte do DoD. |
| **Control Plane** | Repo central que mantém specs e contexto global em setups multi-repo. |
| **Dogfood** | Usar o próprio produto para construir o produto. |
| **Workflow** | Conjunto de estágios (Backlog → Design → Code → Review → Done) que definem o processo de trabalho. Armazenado em `.letra/workflow.json`. |
| **Flow Board** | Visualização no terminal de todos os estágios com contagem de itens e itens ativos. |
| **Backlog** | Primeiro estágio do workflow, onde itens são adicionados antes de serem movidos para outros estágios. |
| **Item** | Unidade de trabalho no workflow, com ID (ITEM-1, ITEM-2), descrição, estágio atual e data de criação. |
| **Adapter Regeneration** | Processo automático que atualiza AGENTS.md, .cursorrules, CLAUDE.md, etc. com o estágio atual e itens ativos após cada `flow move`. |
