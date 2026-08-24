import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "./utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			className={cn("grid w-full gap-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
	return (
		<RadioPrimitive.Root
			data-slot="radio-group-item"
			className={cn(
				"group/radio-group-item peer relative flex aspect-square size-[var(--icon-md)] shrink-0 rounded-full border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-base)] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-[var(--focus-ring-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]/50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[checked]:border-[var(--color-primary)] data-[checked]:bg-[var(--color-primary)] data-[checked]:text-[var(--color-on-accent)]",
				className,
			)}
			{...props}
		>
			<RadioPrimitive.Indicator
				data-slot="radio-group-indicator"
				className="flex size-[var(--icon-md)] items-center justify-center"
			>
				<span className="absolute left-1/2 top-1/2 size-[var(--icon-xs)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-on-accent)]" />
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	);
}

export { RadioGroup, RadioGroupItem };
