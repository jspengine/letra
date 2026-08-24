import React, { useState, useCallback } from "react";
import { Box, Text, useInput, render, useApp, Spacer } from "ink";
import { supportedAdapterTools } from "../adapters/registry.js";

const LOGO = `
   __         __
  / /_____ _/ /____  ____
 / __/ __ \`/ __/ _ \\/ __ \\
/ /_/ /_/ / /_/  __/ / / /
\\__/\\__,_/\\__/\\___/_/ /_/
`;

const PROJECT_TYPES = ["web-app", "cli", "library", "mobile"] as const;

const TOOL_OPTIONS = [
	...supportedAdapterTools().map((adapter) => ({ id: adapter.id, label: adapter.label })),
	{ id: "todos", label: "Todos (recomendado)" },
];

interface WizardResult {
	projectType: string;
	tool: string;
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
	useInput((_input, key) => {
		if (key.return || _input === " ") onNext();
	});

	return (
		<Box flexDirection="column" alignItems="center" paddingY={1}>
			<Text color="cyan">{LOGO}</Text>
			<Text bold> Bem-vindo ao Letra! </Text>
			<Text dimColor> Specification-Driven Development </Text>
			<Spacer />
			<Text dimColor> Pressione Enter para continuar </Text>
		</Box>
	);
}

interface SelectStepProps {
	title: string;
	options: readonly { id: string; label: string }[];
	selected: string;
	onSelect: (id: string) => void;
	onConfirm: () => void;
}

function SelectStep({ title, options, selected, onSelect, onConfirm }: SelectStepProps) {
	const [cursor, setCursor] = useState(0);

	useInput((_input, key) => {
		if (key.upArrow) {
			setCursor((p) => (p > 0 ? p - 1 : options.length - 1));
		} else if (key.downArrow) {
			setCursor((p) => (p < options.length - 1 ? p + 1 : 0));
		} else if (key.return) {
			onSelect(options[cursor].id);
			onConfirm();
		}
	});

	return (
		<Box flexDirection="column" paddingY={1}>
			<Text bold> {title} </Text>
			<Spacer />
			{options.map((opt, i) => (
				<Box key={opt.id} marginY={0}>
					<Text color={i === cursor ? "cyan" : undefined}>
						{i === cursor ? " > " : "   "}
						{opt.label}
						{selected === opt.id ? "  (selecionado)" : ""}
					</Text>
				</Box>
			))}
			<Spacer />
			<Text dimColor> Setas: navegar | Enter: confirmar </Text>
		</Box>
	);
}

function PreviewStep({
	projectType,
	tool,
	onConfirm,
	onBack,
}: {
	projectType: string;
	tool: string;
	onConfirm: () => void;
	onBack: () => void;
}) {
	useInput((_input, key) => {
		if (key.return) onConfirm();
		if (key.escape) onBack();
	});

	return (
		<Box flexDirection="column" paddingY={1}>
			<Text bold> Preview do Setup </Text>
			<Spacer />
			<Box flexDirection="column" paddingX={2}>
				<Text>
					{" "}
					Tipo de projeto: <Text bold>{projectType}</Text>
				</Text>
				<Text>
					{" "}
					Ferramenta IA:{" "}
					<Text bold>{TOOL_OPTIONS.find((t) => t.id === tool)?.label || tool}</Text>
				</Text>
			</Box>
			<Spacer />
			<Box flexDirection="column" paddingX={2}>
				<Text dimColor> Será criado: </Text>
				<Text dimColor> - .letra/ (contexto, constituição, specs) </Text>
				<Text dimColor> - Adapters para a ferramenta selecionada </Text>
				{tool === "vscode" || tool === "todos" ? (
					<Text dimColor> - .vscode/settings.json </Text>
				) : null}
			</Box>
			<Spacer />
			<Text dimColor> Enter: criar | Esc: voltar </Text>
		</Box>
	);
}

function ProgressStep({ done }: { done: boolean }) {
	return (
		<Box flexDirection="column" alignItems="center" paddingY={1}>
			<Text> {done ? " Criado com sucesso!" : " Criando..."} </Text>
			<Spacer />
			<Text color={done ? "green" : "yellow"}>
				{done ? "  .letra/ inicializado" : "  Configurando..."}
			</Text>
		</Box>
	);
}

export async function runInitWizard(): Promise<WizardResult> {
	return new Promise((resolve, reject) => {
		const { waitUntilExit } = render(<WizardApp onDone={resolve} />);
		waitUntilExit()
			.then(() => {})
			.catch(reject);
	});
}

function WizardApp({ onDone }: { onDone: (result: WizardResult) => void }) {
	const [step, setStep] = useState(0);
	const [projectType, setProjectType] = useState<string>("web-app");
	const [tool, setTool] = useState<string>("todos");
	const [creating, setCreating] = useState(false);
	const [created, setCreated] = useState(false);

	const handleFinish = useCallback(() => {
		onDone({ projectType, tool });
	}, [projectType, tool, onDone]);

	if (creating) {
		setTimeout(() => {
			setCreated(true);
			setTimeout(() => handleFinish(), 500);
		}, 10);
		return <ProgressStep done={created} />;
	}

	switch (step) {
		case 0:
			return <WelcomeStep onNext={() => setStep(1)} />;
		case 1:
			return (
				<SelectStep
					title="Tipo de projeto?"
					options={PROJECT_TYPES.map((t) => ({ id: t, label: t }))}
					selected={projectType}
					onSelect={setProjectType}
					onConfirm={() => setStep(2)}
				/>
			);
		case 2:
			return (
				<SelectStep
					title="Ferramenta de IA?"
					options={TOOL_OPTIONS.map((t) => ({ id: t.id, label: t.label }))}
					selected={tool}
					onSelect={setTool}
					onConfirm={() => setStep(3)}
				/>
			);
		case 3:
			return (
				<PreviewStep
					projectType={projectType}
					tool={tool}
					onConfirm={() => {
						setCreating(true);
						setStep(4);
					}}
					onBack={() => setStep(2)}
				/>
			);
		default:
			return null;
	}
}
