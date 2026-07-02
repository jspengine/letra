# Politica de Escrita por Tipo de Artefato

**Spec**: `architecture-convergence`  
**Item**: `ITEM-51`  
**Date**: 2026-06-29  
**Status**: Approved for incremental adoption

---

## Objetivo

Definir quem pode escrever cada tipo de artefato do workspace e quais efeitos
devem acompanhar a escrita. A politica evita que comandos, servidor, UI e
diagnosticos implementem separadamente invariantes do dominio.

Esta politica especializa, para a convergencia arquitetural, o contrato descrito
em `../workspace-runtime-governance/write-gateway.md`.

## Regra central

Todo artefato tem uma unica classe primaria e um escritor responsavel.

Quando uma mutacao altera estado canonico, o chamador declara a intencao e
delega a escrita ao gateway responsavel. O chamador nao replica validacoes,
auditoria, regeneracao de derivados ou regras de rollback.

## Classes de artefato

### 1. Canonico

Representa regras ou estado que nao podem ser reconstruidos sem perda.

Exemplos atuais:

- `.letra/workflow.json`: estado transacional do flow
- `.letra/constitution.md`: regras normativas
- `.letra/specs/**`: contratos de escopo e aceite
- `.letra/decisions/**`: decisoes arquiteturais aprovadas
- harness versionado: definicoes de flows, gates, roles e politicas
- `.letra/workspace.json`, quando introduzido: configuracao do workspace

Politica:

- somente comandos ou gateways que conhecem as invariantes do artefato escrevem
- toda mutacao relevante registra ator, causa, alvo e resultado
- mudancas sujeitas a gate humano somente persistem depois da aprovacao
- escrita direta por UI, adapters ou read models e proibida

### 2. Derivado

Representa uma projecao reconstruivel a partir de artefatos canonicos e, quando
necessario, evidencias.

Exemplos atuais:

- `.letra/focus.md`
- bloco `sitrep` de `.letra/context.md`
- `AGENTS.md`, `CLAUDE.md`, `.cursorrules` e demais adapters
- definicao normalizada do flow ativo em memoria
- visoes da Web UI, indices, caches e futuras projecoes em PGlite

Politica:

- deve declarar ou permitir identificar sua fonte canonica
- pode ser sobrescrito ou regenerado, mas nunca tratado como autoridade
- falha de regeneracao nao desfaz uma escrita canonica valida
- o erro deve ficar observavel e a regeneracao deve poder ser repetida

Artefatos compostos exigem fronteiras explicitas. Em `.letra/context.md`, o
conteudo curado por humanos e canonico; apenas o bloco demarcado `sitrep` e
derivado e pode ser regenerado automaticamente.

### 3. Evidencia

Registra o que ocorreu, quem agiu, quando, por que e com qual resultado.

Exemplos atuais:

- `.letra/session-log.json`
- `.letra/health-record.json`
- `.letra/reports/**`
- eventos de runs, findings e referencias a artefatos gerados
- hashes de entrada e saida de operacoes de IA

Politica:

- evidencia e registrada pelo servico especializado, nao pelo chamador
- registros historicos sao append-only em termos logicos
- correcao ou resolucao gera novo evento; nao apaga o fato anterior
- evidencia nao pode alterar estado canonico por efeito colateral
- falha de evidencia apos escrita canonica deve ser reportada como falha parcial

O `health-record.json` mantem o estado persistente dos alertas, mas pertence a
esta classe porque sua autoridade se limita ao diagnostico. Ele nao substitui
`workflow.json`, specs ou constitution como fonte do dominio.

### 4. Rollback

Preserva material suficiente para reverter uma mutacao canonica autorizada.

Exemplos atuais:

- `.letra/snapshots/**`
- backups de importacao ou edicao de workflow

Politica:

- e criado antes da mutacao que protege
- referencia artefato, versao de origem, causa e operacao correspondente
- nao participa de leituras normais do dominio
- restauracao passa pelo mesmo gateway do artefato canonico restaurado
- expiracao ou limpeza segue politica explicita e nunca altera o canonico

## Matriz de responsabilidade atual

| Artefato | Classe | Escritor responsavel | Regra |
|---|---|---|---|
| `workflow.json` | canonico | `writeWorkflow()` | unico gateway transacional atual |
| specs e ACs | canonico | comandos `spec`, `ac` e `flow ac` | preservar gate e registrar conclusao |
| constitution e decisions | canonico | fluxo humano aprovado | nenhuma automacao silenciosa |
| harness | canonico | loader/synchronizer versionado | produto consome; nao redefine localmente |
| `focus.md` | derivado | `focus-sync` | projetar item/spec ativos do workflow |
| bloco `sitrep` de `context.md` | derivado | comando `sitrep` | alterar somente o bloco demarcado |
| adapters | derivado | `generateAdapters()` | sempre regeneraveis |
| `session-log.json` | evidencia | `logEntry()` | trilha operacional logica append-only |
| `health-record.json` | evidencia | health store/diagnostics engine | autoridade apenas sobre diagnosticos |
| snapshots | rollback | `SnapshotStore` | capturar antes; restaurar pelo gateway |

Escritas diretas existentes fora desses responsaveis sao legado compativel, nao
precedente arquitetural. Novos chamadores nao podem amplia-las.

## Ordem de uma mutacao

1. receber a intencao com ator, causa, alvo e versao esperada
2. validar schema, invariantes e gates humanos
3. criar rollback quando a operacao for reversivel
4. persistir atomicamente o artefato canonico
5. registrar evidencia e auditoria
6. regenerar ou agendar artefatos derivados
7. publicar evento observavel para UI e supervisao

Somente a etapa 4 muda a autoridade do dominio. Etapas posteriores podem ser
repetidas sem repetir a mutacao canonica.

## Falhas e consistencia

- falha antes da escrita canonica: abortar sem derivados
- falha depois da escrita canonica: manter o canonico, registrar falha parcial e
  permitir replay dos efeitos pendentes
- conflito de versao: rejeitar a escrita e exigir nova leitura
- rollback: validar a versao alvo e executar como nova mutacao auditada
- projecao divergente: descartar e reconstruir a partir do canonico

## Aplicacao incremental

Vigora imediatamente:

- classificacao e responsabilidade desta politica para todo codigo novo
- `writeWorkflow()` como gateway especializado de `workflow.json`
- proibicao de novas mutacoes canonicas diretas em rotas, UI ou adapters
- revisao de mudancas com base na matriz de responsabilidade

Fica para itens posteriores:

- criar o `DomainWriteGateway` geral
- encapsular `workspace.json` em store proprio
- migrar escritores diretos legados
- introduzir auditoria estruturada e `sourceVersion`
- adicionar PGlite exclusivamente como projecao derivada

Essa separacao preserva compatibilidade e evita transformar o AC9 em uma
refatoracao big-bang.

## Invariantes

1. existe uma unica autoridade de escrita por artefato canonico
2. derivados nunca se tornam fonte primaria
3. evidencias nao executam mutacoes canonicas
4. rollback nunca contorna validacoes ou gates
5. efeitos automaticos relevantes permanecem visiveis e rastreaveis
6. toda projecao pode ser reconstruida sem editar o canonico

## Referencias

- `C:\Workspace\letra\.letra\constitution.md`
- `C:\Workspace\letra\.letra\specs\activity-context\architecture-current-state.md`
- `C:\Workspace\letra\.letra\specs\workspace-runtime-governance\design.md`
- `C:\Workspace\letra\.letra\specs\workspace-runtime-governance\write-gateway.md`
- `C:\Workspace\letra\.letra\specs\workspace-runtime-governance\phase-1-implementation-plan.md`
