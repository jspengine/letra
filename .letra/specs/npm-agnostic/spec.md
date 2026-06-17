# Spec: Remover dependência de npm para publish

> Updated: 2026-06-16

## Outcome

Letra funciona em qualquer projeto — C#, Python, Go, Rust, ou nenhum código.
Usuários não precisam de npm, Node.js, ou `package.json` no projeto alvo.
Letra não executa build/test — isso é responsabilidade do CI/CD e do dev.

## Problema

4 blockers que crasham em projetos não-Node:

1. `pulse.ts:98` — `execSync("npm run build")` → ENOENT sem npm
2. `pulse.ts:107`, `sitrep.ts:97` — `execSync("npm run test")` → ENOENT sem npm
3. `validate.ts:256-270` — `npx tsx ...` (4x) → ENOENT sem npx
4. `validate.ts:300` — `readFileSync(package.json)` → ENOENT sem o arquivo

**Nuance descoberta na análise:** `validate.ts` é dogfooding-only — o entry point `src/index.ts` (linha 182) não existe em projetos externos. Mesmo usuários Node que instalarem via `npx @letra-ai/cli` não têm esse arquivo no projeto alvo. O bloco inteiro de `npx tsx` é invalidado.

## Abordagem

Remover build/test do Letra. Não é responsabilidade do produto executar scripts de build ou teste do projeto alvo — isso duplica CI/CD e cria blockers desnecessários.

Em vez de configurar comandos, o init **detecta a linguagem** para personalizar os templates gerados com conteúdo relevante para o ecossistema do usuário.

**Web UI**: ganha um badge de linguagem visível. As seções de build/test nunca existiram no frontend, então não há nada a remover.

## LANGUAGE_REGISTRY

```typescript
// packages/cli/src/adapters/language-registry.ts
interface LangConfig {
  name: string          // "C# (.NET)"
  detect: string[]      // arquivos de manifest (glob)
}

const LANGUAGE_REGISTRY: LangConfig[] = [
  { name: "Node.js",     detect: ["package.json"] },
  { name: "Python",      detect: ["pyproject.toml", "setup.py", "requirements.txt"] },
  { name: "C# (.NET)",   detect: ["*.csproj", "*.sln"] },
  { name: "Java",        detect: ["pom.xml", "build.gradle"] },
  { name: "Go",          detect: ["go.mod"] },
  { name: "Rust",        detect: ["Cargo.toml"] },
  { name: "PHP",         detect: ["composer.json"] },
  { name: "Ruby",        detect: ["Gemfile"] },
  { name: "C/C++",       detect: ["CMakeLists.txt", "Makefile"] },
  { name: "Swift",       detect: ["Package.swift"] },
]
```

Fluxo: init escaneia diretório → primeiro match → pergunta confirmação ao usuário → templates personalizados. Se múltiplos matches (monorepo híbrido), pergunta ao usuário qual escolher.

## Acceptance Criteria

### AC1: pulse não executa build/test
- `pulse.ts:96-104`: `checkBuild()` removido
- `pulse.ts:105-132`: `checkTests()` removido
- `pulse.ts:3`: `import { execSync }` removido
- `pulse.ts:32-33`: `PulseData.build` e `PulseData.tests` removidos do tipo
- `pulse.ts:207-211`: chamadas `checkBuild()`/`checkTests()` removidas
- `pulse.ts:217`: `renderPulseText()` sem parâmetro `showBuild`
- `pulse.ts:266-279`: seção de output build/test removida
- `pulse.ts:278`: dica "Passe --build e/ou --test" removida
- `pulse.ts:298-299`: flags `--build`/`--test` removidas do comando Commander

### AC2: sitrep não executa build/test
- `sitrep.ts:1`: `import { execSync }` removido
- `sitrep.ts:26-28`: `SitrepData.testResult` e `buildOk` removidos do tipo
- `sitrep.ts:95-120`: `checkTests()` removido
- `sitrep.ts:122-129`: `checkBuild()` removido
- `sitrep.ts:165-178`: bloco de renderização build/test removido
- `sitrep.ts:272-273`: chamadas `checkTests()`/`checkBuild()` removidas
- `sitrep.ts:281,307`: campos `testResult`/`testPassing`/`buildOk` removidos

### AC3: validate não executa heurísticas do projeto alvo
- `validate.ts:1`: `import { execSync, ExecSyncOptions }` removido
- `validate.ts:182-188`: bloco `entryPoint = join(root, "src/index.ts")` + `opts` removido
- `validate.ts:250-270`: bloco `npx tsx ...` (4x: init, init, smoke-test, lint) removido
- `validate.ts:274-307`: CI gate checks (npm/vitest/tsc/typecheck/distribuição npm) + `readFileSync(package.json)` removido

### AC4: init detecta linguagem e personaliza templates
- `flow-init.ts:90-99`: `detectProjectName()` com fallback para nome do diretório (sem crash se não existir package.json)
- Init adiciona `detectLanguage()`: escaneia raiz por arquivos do LANGUAGE_REGISTRY
- Se detectado: pergunta "Detectado [Linguagem]. Confirma? [Y/n]"
- Se múltiplos matches: lista opções para o usuário escolher
- Se nada detectado: `"general"` — templates neutros
- `init.ts` templates dinâmicos:
  - **context.md**: "Stack: {linguagem}" em vez de "TypeScript, Node.js 22+..."
  - **constitution.md**: sem "TypeScript estrito (strict: true)" se não for TS
  - **lessons-learned.md**: sem "TypeScript domina CLIs em 2026 (82% dos novos pacotes npm)"
  - **.vscode/settings.json**: não gerado, a menos que linguagem seja Node.js/TypeScript (então pergunta)
- `flow-init.ts` (ou init.ts): `language` é salvo no `workflow.json` para consulta pela web UI
- `init.ts:251-253`: corrigir `letra init --serve` para criar `workflow.json` automaticamente (hoje cria `.letra/` mas não workflow — servidor morre)
- `Workflow` type em `flow-init.ts:55-66` ganha `language?: string` (necessário pro type checker)
- `POST /api/workflow/template` em `flow-serve.ts:187-206`: preservar `language` do workflow existente ao criar novo

### AC5: Nada quebrado em projetos existentes
- Testes existentes continuam passando
- `pulse.test.ts:192-198`: teste "should have skipped build and test" atualizado ou removido

### AC6: Web UI exibe badge de linguagem detectada
- `Header.tsx` (ou DashboardView) exibe badge com a linguagem detectada (ex: "C# .NET", "Python", "Node.js", "general")
- Badge lê o campo `language` do `workflow.json` via `GET /api/workflow`
- Se `language` não existir (workflows antigos), badge não aparece — sem quebra
- `InlineSetupWizard` (step de boas-vindas) mostra "Projeto {linguagem} detectado" se o campo existir
- **PERSISTÊNCIA**: `POST /api/workflow/template` (flow-serve.ts) precisa preservar `language` do workflow existente — o badge não pode sumir quando usuário configura stages no wizard

## UX Journey — Antes vs Depois

```
ANTES (npm-locked):                    DEPOIS (agnostic):

$ letra init                            $ letra init
  → templates falam TS/npm                → detecta C# .NET
  → context.md: "82% npm são TS"          → templates personalizados
  → .vscode/ com ESLint/Prettier          → .vscode/ não gerado

$ letra pulse --build                    $ letra pulse
  → CRASH (ENOENT)                         → stages | specs | health
                                           → sem build/test

$ letra validate                         $ letra validate
  → npx tsx → CRASH                        → specs | ACs | workflow
  → package.json → CRASH                   → sem CI checks
  → CI checks → FAIL                       → 0% crash

Web UI (Dashboard)                       Web UI (Dashboard)
  → itens | stages | health                → itens | stages | health | badge "C# .NET"
  → sem badge de linguagem                 → Header mostra linguagem detectada
```

## Escopo futuro (fora deste spec)

- AC6 (zone="doing" em vez de hardcode "code"/"review") → Fase 2 da arquitetura
- Flow-move / flow-claim: hardcode "opencode" como agent name
- Template stages em flow-serve.ts
- Melhorias no harness, loop de execução, visual feedback do agente — especificar separadamente

## Notas de Implementação

- `pulse.ts`: ~25 linhas removidas (checkBuild, checkTests, flags, render, import, types)
- `sitrep.ts`: ~30 linhas removidas (checkTests, checkBuild, render, import, types)
- `validate.ts`: ~40 linhas removidas (npx tsx, CI checks, package.json, import)
- `flow-init.ts`: ~40 linhas adicionadas (LANGUAGE_REGISTRY, detectLanguage, wizard, language em workflow.json)
- `init.ts`: ~10 linhas alteradas (templates dinâmicos)
- `pulse.test.ts`: 1 teste atualizado ou removido
- Novo arquivo: `packages/cli/src/adapters/language-registry.ts` (~40 linhas)
- `workflow.json`: adiciona campo opcional `language` (sem quebra pra workflows existentes)
- `Header.tsx`: ~5 linhas adicionadas (badge de linguagem condicional)
- `InlineSetupWizard.tsx`: ~3 linhas (exibe linguagem no step de boas-vindas)
