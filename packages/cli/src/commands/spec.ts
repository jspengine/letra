import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";
import { getLetraDir } from "./../workspace/resolver.js";

const builtInTemplates: Record<string, { spec: string; acceptance: string }> = {
	"web-api": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Usuário consegue fazer requisições HTTP para a API e receber respostas padronizadas.

## Constraints
- RESTful遵循 (GET, POST, PUT, DELETE)
- Autenticação via Bearer token JWT
- Rate limiting: 100 req/min por usuário
- Timeout máximo de 30s por requisição

## Exclusions
- WebSocket não está no escopo
- Upload de arquivos não está no escopo inicial

## Acceptance Criteria
- [ ] **CRUD**: CRUD completo para o recurso principal (GET, POST, PUT, DELETE retornam 200/201/204).
- [ ] **Autenticação**: Rota sem token retorna 401, rota com token inválido retorna 403.
- [ ] **Validação**: Payload inválido retorna 422 com mensagem de erro descritiva.
- [ ] **Rate Limit**: Exceder 100 req/min retorna 429 com header Retry-After.
- [ ] **Paginação**: GET com ?page=2&limit=10 retorna página correta com total count.

## Context
Template para APIs REST. Adaptado para o domínio específico do projeto.`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **CRUD**: CRUD completo para o recurso principal (GET, POST, PUT, DELETE retornam 200/201/204).
- [ ] **Autenticação**: Rota sem token retorna 401, rota com token inválido retorna 403.
- [ ] **Validação**: Payload inválido retorna 422 com mensagem de erro descritiva.
- [ ] **Rate Limit**: Exceder 100 req/min retorna 429 com header Retry-After.
- [ ] **Paginação**: GET com ?page=2&limit=10 retorna página correta com total count.`,
	},
	"cli-tool": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Usuário instala e executa a CLI, recebendo output formatado no terminal.

## Constraints
- Node.js 22+ como runtime
- Deve funcionar em Windows, macOS e Linux
- Exit codes seguem padrão Unix (0 sucesso, 1 erro)
- --help deve funcionar sem argumentos

## Exclusions
- UI gráfica não está no escopo
- Modo servidor/daemon não está no escopo

## Acceptance Criteria
- [ ] **Instalação**: CLI executável via npx/npm install -g sem erros.
- [ ] **--help**: Roda sem argumentos, exibe ajuda com subcomandos.
- [ ] **Subcomando**: Subcomando principal executa sem erros e exibe output.
- [ ] **Erro**: Subcomando inválido exibe erro amigável e exit 1.
- [ ] **Cross-platform**: Funciona em Windows (cmd/powershell), macOS (zsh) e Linux (bash).

## Context
Template para ferramentas de linha de comando. Adaptado para o escopo específico.`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **Instalação**: CLI executável via npx/npm install -g sem erros.
- [ ] **--help**: Roda sem argumentos, exibe ajuda com subcomandos.
- [ ] **Subcomando**: Subcomando principal executa sem erros e exibe output.
- [ ] **Erro**: Subcomando inválido exibe erro amigável e exit 1.
- [ ] **Cross-platform**: Funciona em Windows (cmd/powershell), macOS (zsh) e Linux (bash).`,
	},
	"mobile-feature": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Usuário consegue acessar e interagir com a nova funcionalidade no aplicativo mobile.

## Constraints
- Suporte a iOS 16+ e Android 13+
- Offline-first: funcionalidade deve funcionar sem internet
- Tempo de resposta < 200ms para interações locais
- Acessibilidade: VoiceOver (iOS) e TalkBack (Android)

## Exclusions
- Versão web não está no escopo (mobile-only)
- Suporte a tablets é desejável mas não obrigatório

## Acceptance Criteria
- [ ] **Tela principal**: Nova funcionalidade aparece na navegação principal.
- [ ] **Offline**: Funcionalidade completa funciona sem conexão de rede.
- [ ] **Performance**: Scroll da lista com 1000+ itens mantém 60fps.
- [ ] **Acessibilidade**: Todos os elementos têm label de acessibilidade.
- [ ] **Dark Mode**: Funcionalidade respeita o tema do sistema.

## Context
Template para features mobile nativas. Adaptado para o framework específico (SwiftUI/Compose).`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **Tela principal**: Nova funcionalidade aparece na navegação principal.
- [ ] **Offline**: Funcionalidade completa funciona sem conexão de rede.
- [ ] **Performance**: Scroll da lista com 1000+ itens mantém 60fps.
- [ ] **Acessibilidade**: Todos os elementos têm label de acessibilidade.
- [ ] **Dark Mode**: Funcionalidade respeita o tema do sistema.`,
	},
	"campanha-marketing": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Equipe de marketing consegue planejar, executar e medir uma campanha de marketing multicanal.

## Constraints
- Conteúdo aprovado pelo time de branding antes da publicação
- Orçamento definido e aprovado antes do início
- Métricas de performance disponíveis em até 24h após cada ação

## Exclusions
- Criação de conteúdo visual (design gráfico) não está no escopo
- Integração com CRM não está no escopo inicial

## Acceptance Criteria
- [ ] **Plano**: Campanha documentada com canais, cronograma e orçamento.
- [ ] **Conteúdo**: Todos os materiais revisados e aprovados antes do lançamento.
- [ ] **Veiculação**: Campanha ativa nos canais planejados na data prevista.
- [ ] **Métricas**: Relatório pós-campanha com alcance, engajamento e ROI.
- [ ] **Lições**: Documentação de aprendizados para próxima campanha.

## Context
Template para campanhas de marketing. Adaptado para o canal e público específicos.`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **Plano**: Campanha documentada com canais, cronograma e orçamento.
- [ ] **Conteúdo**: Todos os materiais revisados e aprovados antes do lançamento.
- [ ] **Veiculação**: Campanha ativa nos canais planejados na data prevista.
- [ ] **Métricas**: Relatório pós-campanha com alcance, engajamento e ROI.
- [ ] **Lições**: Documentação de aprendizados para próxima campanha.`,
	},
	"pesquisa": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Pesquisador consegue coletar, analisar e documentar resultados de uma pesquisa qualitativa ou quantitativa.

## Constraints
- Termo de consentimento aprovado pelo comitê de ética
- Dados anonimizados antes da análise
- Prazo de coleta definido e comunicado aos participantes

## Exclusions
- Análise estatística avançada não está no escopo
- Publicação acadêmica não está no escopo

## Acceptance Criteria
- [ ] **Roteiro**: Instrumento de coleta (questionário/roteiro) revisado e aprovado.
- [ ] **Coleta**: Respostas coletadas dentro do prazo com mínimo de participantes definido.
- [ ] **Análise**: Dados processados e principais descobertas documentadas.
- [ ] **Relatório**: Documento final com metodologia, resultados e recomendações.
- [ ] **Dados**: Base anonimizada arquivada conforme política de retenção.

## Context
Template para pesquisas de mercado, acadêmicas ou de produto. Adaptado para a metodologia específica.`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **Roteiro**: Instrumento de coleta (questionário/roteiro) revisado e aprovado.
- [ ] **Coleta**: Respostas coletadas dentro do prazo com mínimo de participantes definido.
- [ ] **Análise**: Dados processados e principais descobertas documentadas.
- [ ] **Relatório**: Documento final com metodologia, resultados e recomendações.
- [ ] **Dados**: Base anonimizada arquivada conforme política de retenção.`,
	},
	"evento": {
		spec: `# Spec: {{name}}

> Updated: {{date}}

## Outcome
Organizador consegue planejar, promover e executar um evento com cronograma, recursos e métricas de sucesso.

## Constraints
- Local e data confirmados antes da divulgação
- Orçamento aprovado com margem de contingência de 15%
- Acessibilidade: evento acessível para pessoas com deficiência

## Exclusions
- Venda de ingressos (plataforma terceirizada) não está no escopo
- Transmissão ao vivo não está no escopo inicial

## Acceptance Criteria
- [ ] **Programação**: Agenda definida com palestrantes, horários e salas.
- [ ] **Divulgação**: Material de divulgação publicado com pelo menos 30 dias de antecedência.
- [ ] **Logística**: Recursos (som, projeção, coffee break) confirmados 7 dias antes.
- [ ] **Execução**: Evento realizado conforme programação com desvios documentados.
- [ ] **Pós-evento**: Relatório com presença, feedback e financeiro entregue em 7 dias.

## Context
Template para eventos corporativos, comunitários ou técnicos. Adaptado para o porte e formato do evento.`,
		acceptance: `# Acceptance Criteria — {{name}}

- [ ] **Programação**: Agenda definida com palestrantes, horários e salas.
- [ ] **Divulgação**: Material de divulgação publicado com pelo menos 30 dias de antecedência.
- [ ] **Logística**: Recursos (som, projeção, coffee break) confirmados 7 dias antes.
- [ ] **Execução**: Evento realizado conforme programação com desvios documentados.
- [ ] **Pós-evento**: Relatório com presença, feedback e financeiro entregue em 7 dias.`,
	},
};

function listTemplates(root: string): string[] {
	const names = Object.keys(builtInTemplates);
	const customDir = join(getLetraDir(root), "templates");
	if (existsSync(customDir)) {
		for (const file of readdirSync(customDir)) {
			if (file.endsWith(".md")) {
				const name = file.replace(/\.md$/, "");
				if (!names.includes(name)) names.push(name);
			}
		}
	}
	return names;
}

function findTemplate(root: string, type: string): { spec: string; acceptance: string } | null {
	const lower = type.toLowerCase();
	if (builtInTemplates[lower]) return builtInTemplates[lower];
	const customFile = join(getLetraDir(root), "templates", `${type}.md`);
	const customAcceptance = join(getLetraDir(root), "templates", `${type}-acceptance.md`);
	if (existsSync(customFile)) {
		const spec = readFileSync(customFile, "utf-8");
		const acceptance = existsSync(customAcceptance)
			? readFileSync(customAcceptance, "utf-8")
			: `# Acceptance Criteria — ${type}\n\n- [ ] **Critério 1**: Descrição binária (passa/falha).\n`;
		return { spec, acceptance };
	}
	return null;
}

function applyPlaceholders(content: string, name: string, date: string): string {
	return content.replace(/\{\{name\}\}/g, name).replace(/\{\{date\}\}/g, date);
}

export function specLink(itemId: string, specName: string): void {
	const root = resolve(process.cwd());
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found"));
		process.exit(1);
	}

	const item = workflow.items.find((i) => i.id === itemId);
	if (!item) {
		console.log(chalk.red(`Item ${itemId} not found`));
		process.exit(1);
	}

	const specDir = join(getLetraDir(root), "specs", specName);
	if (!existsSync(specDir)) {
		console.log(chalk.red(`Spec "${specName}" not found at .letra/specs/${specName}/`));
		return;
	}

	item.spec = specName;
	if (!workflow.specLinks) workflow.specLinks = {};
	workflow.specLinks[specName] = { path: `.letra/specs/${specName}/spec.md` };
	workflow.updatedAt = new Date().toISOString();

	writeWorkflow(root, { workflow, source: "flow-edit", skipSitrep: true });
	logEntry(root, "manual", `spec linked: ${itemId} → ${specName}`, { itemId });

	console.log(`  ${chalk.green("✓")} ${itemId} → ${chalk.cyan(specName)}`);
}

export async function specNew(name: string, options?: { template?: string }) {
	const root = resolve(process.cwd());
	const letraDir = getLetraDir(root);
	const specDir = join(letraDir, "specs", name);

	if (!existsSync(letraDir)) {
		console.log(chalk.red(".letra/ not found. Run 'letra init' first."));
		process.exit(1);
	}

	if (existsSync(specDir)) {
		console.log(chalk.yellow(`Spec "${name}" already exists`));
		return;
	}

	const templateType = options?.template || "_default";
	const template = templateType === "_default" ? null : findTemplate(root, templateType);

	if (options?.template && !template) {
		const available = listTemplates(root).join(", ");
		console.log(chalk.red(`Template "${options.template}" not found. Available: ${available}`));
		process.exit(1);
	}

	const spinner = ora(`Creating spec "${name}"...`).start();

	try {
		const today = new Date().toISOString().split("T")[0];
		mkdirSync(specDir, { recursive: true });

		if (template) {
			const specContent = applyPlaceholders(template.spec, name, today);
			const acceptanceContent = applyPlaceholders(template.acceptance, name, today);
			writeFileSync(join(specDir, "spec.md"), specContent);
			writeFileSync(join(specDir, "acceptance.md"), acceptanceContent);
		} else {
			const specContent = `# Spec: ${name}

> Updated: ${today}

## Outcome
O que o usuário consegue fazer quando isso estiver pronto.

## Constraints
Limitações técnicas e de negócio que não podem ser violadas.

## Exclusions
O que explicitamente NÃO está neste escopo.

## Acceptance Criteria
- [ ] **Critério 1**: Descrição binária (passa/falha).

## Context
Por que estamos construindo isso. Trade-offs considerados.
`;

			const acceptanceContent = `# Acceptance Criteria — ${name}

- [ ] **Critério 1**: Descrição binária (passa/falha).
`;

			writeFileSync(join(specDir, "spec.md"), specContent);
			writeFileSync(join(specDir, "acceptance.md"), acceptanceContent);
		}

		spinner.succeed(chalk.green(`Spec "${name}" created at .letra/specs/${name}/`));
	} catch (error) {
		spinner.fail(chalk.red("Failed to create spec"));
		process.exit(1);
	}
}
