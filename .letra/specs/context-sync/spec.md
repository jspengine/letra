# Spec: Context Sync — Sincronização Automática do Contexto

> Updated: 2026-06-15

## Outcome

`context.md` reflete automaticamente o estado real do projeto — contagem de testes, estágio atual, data, itens correntes — sem exigir edição manual. O desenvolvedor/agente só precisa editar as seções narrativas (Intent, Domínio, Porquês).

## Constraints

- Não sobrescreve seções manuais: `## Intent`, `## Domínio`, `## Porquês`
- Atualiza apenas: `> Updated:`, `## Estado Atual` e subseções computáveis
- Falha silenciosamente se `vitest` não estiver instalado (test count unavailable)
- Compatível com formatos de CI — `vitest run --reporter=json` pipeável
- Geração puramente local — sem dependência de rede

## Architecture

```
letra context sync [path]
    ↓
1. Ler context.md atual
2. Extrair seções manuais (Intent, Domínio, Porquês) — preservar intactas
3. Computar:
    ├── Updated: Date.now() → ISO date string
    ├── Estágio atual: do workflow.json (active stage)
    ├── Itens correntes: do workflow.json (itens no estágio ativo)
    ├── Testes passando: vitest run --reporter=json → total
    └── Build: npm run build --silent → exit code (0 = limpo, else = falha)
4. Reconstruir context.md:
    ├── # Context\n> Updated: {data}\n> Owner: (preservado)
    ├── ## Intent (preservado)
    ├── ## Domínio (preservado)
    ├── ## Estado Atual (gerado)
    ├── ## Stack (preservado — infrequente mudar)
    ├── ## Restrições Reais (preservado)
    └── ## Porquês (preservado)
5. Escrever context.md
```

### Seção gerada: ## Estado Atual

```markdown
## Estado Atual (2026-06-15)

- **Estágio**: Design
- **Itens correntes**: ITEM-34 a ITEM-39 (expansão de diagnóstico)
- **Recente**:
  - Detector harness-meta-test criado (valida o próprio harness)
  - 5 detectores novos (spec-code-drift, snapshot-bloat, cross-spec-dep, etc.)
  - TTL de snapshots alinhado para 30 dias
- **CLI**: init, flow, diagnose, lint, validate
- **Web UI**: Flow designer, spec viewer, diagnostics dashboard
- **Build**: 168/168 testes passando | Build limpo
```

## Acceptance Criteria

- [ ] **Preservação**: Seções Intent, Domínio, Stack, Restrições, Porquês não são modificadas
- [ ] **Updated**: Campo `> Updated:` atualizado para a data do sync
- [ ] **Estágio**: Lido de `.letra/workflow.json` — estágio que contém itens
- [ ] **Testes**: `vitest run --reporter=json` parseado para contagem passing/total
- [ ] **Build**: `npm run build --silent` verifica se build compila (exit code)
- [ ] **Fallback**: Se vitest falha, "Testes" mostra "N/A (vitest unavailable)"
- [ ] **Fallback**: Se build falha, "Build" mostra "Falha — verifique o build"
- [ ] **CLI**: `letra context sync [path]` é o comando; `letra context sync --dry-run` mostra diff sem escrever
- [ ] **Meta-test**: Detector alerta se context.md `Updated:` > 7 dias e não houve sync recente
- [ ] **Testes**: Sync preserva seções manuais, atualiza data, fallback sem vitest

## Exclusions

- Edição automática de `constitution.md` — regras são decisões humanas
- Geração de conteúdo narrativo (Intent, Domínio, Porquês)
- Suporte a outros runners de teste além de vitest

## Context

Context.md é a fonte da verdade sobre o estado do projeto, mas frequentemente fica desatualizada porque ninguém a edita manualmente. Este spec automatiza a parte computável do contexto, liberando o humano/agente para focar apenas na narrativa. O meta-test garante que o contexto não fique estagnado por mais de 7 dias.
