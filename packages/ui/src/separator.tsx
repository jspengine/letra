import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
	orientation?: "horizontal" | "vertical";
	decorative?: boolean;
}

export function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	...props
}: SeparatorProps) {
	return (
		<div
			data-slot="separator"
			role={decorative ? undefined : "separator"}
			aria-orientation={orientation}
			aria-hidden={decorative ? true : undefined}
			className={cn(
				"shrink-0 border-0 bg-[var(--color-border)]",
				orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
				className,
			)}
			{...props}
		/>
	);
}
