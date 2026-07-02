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
