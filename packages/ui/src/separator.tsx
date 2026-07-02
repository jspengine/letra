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
		<hr
			aria-orientation={orientation}
			aria-hidden={decorative}
			className={cn(
				"shrink-0 bg-border",
				orientation === "horizontal" ? "h-[1px] w-full" : "w-[1px] h-full",
				className,
			)}
			{...props}
		/>
	);
}