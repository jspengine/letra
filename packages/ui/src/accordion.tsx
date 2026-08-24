import "./index.css";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			className={cn("flex w-full flex-col", className)}
			{...props}
		/>
	);
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn("border-b border-[var(--color-border)]", className)}
			{...props}
		/>
	);
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"group/accordion-trigger relative flex flex-1 items-center justify-between gap-[var(--space-2)] rounded-none bg-[var(--color-bg-surface)] px-[var(--space-4)] py-[var(--space-3)] text-left text-sm font-medium text-[var(--color-text-primary)] transition-all duration-150 outline-none hover:bg-[var(--color-bg-sunken)] active:scale-[0.995] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
					className,
				)}
				{...props}
			>
				{children}
				<span className="inline-flex size-[var(--icon-md)] shrink-0 items-center justify-center text-[var(--color-text-secondary)] transition-transform duration-150 group-aria-expanded/accordion-trigger:rotate-180">
					<ChevronDown aria-hidden="true" className="size-[var(--icon-md)]" />
				</span>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			data-slot="accordion-content"
			className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
			{...props}
		>
			<div className={cn("h-auto px-[var(--space-4)] py-[var(--space-3)]", className)}>
				{children}
			</div>
		</AccordionPrimitive.Panel>
	);
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
