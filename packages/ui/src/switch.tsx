import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "./utils";

function Switch({
	className,
	size = "default",
	...props
}: SwitchPrimitive.Root.Props & { size?: "sm" | "default" }) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-input)] transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-[var(--focus-ring-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]/50 data-[size=default]:h-[20px] data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 data-[checked]:border-[var(--color-primary)] data-[checked]:bg-[var(--color-primary)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block rounded-full bg-[var(--color-bg-surface)] shadow-sm transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[checked]/switch:translate-x-[calc(100%+2px)] group-data-[unchecked]/switch:translate-x-0"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
