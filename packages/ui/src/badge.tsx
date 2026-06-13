import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "./utils";

type Variant = "default" | "secondary" | "outline" | "success" | "warning";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
	default: "bg-primary/10 text-primary border border-primary/20",
	secondary: "bg-muted text-muted-foreground border border-border",
	outline: "bg-transparent text-foreground border border-border",
	success: "",
	warning: "",
};

function getVariantStyle(v: Variant): CSSProperties | undefined {
	if (v === "success" || v === "warning") {
		return {
			background: `var(--${v})`,
			color: `var(--${v}-foreground)`,
			borderColor: `var(--${v})`,
		};
	}
	return undefined;
}

export function Badge({
	variant = "default",
	className,
	children,
	style,
	...props
}: BadgeProps) {
	const varStyle = getVariantStyle(variant);
	return (
		<span
			className={cn(
				"inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
				!varStyle && variantStyles[variant],
				className,
			)}
			style={{ ...varStyle, ...style }}
			{...props}
		>
			{children}
		</span>
	);
}
