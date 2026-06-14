import { Icon } from "./icon";
import { cn } from "./utils";

interface AvatarProps {
	name?: string;
	src?: string;
	size?: "sm" | "md" | "lg";
	className?: string;
}

const sizeMap = {
	sm: "w-6 h-6 text-[10px]",
	md: "w-8 h-8 text-xs",
	lg: "w-10 h-10 text-sm",
};

const iconSizeMap = { sm: 14, md: 16, lg: 20 } as const;

function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return parts[0].slice(0, 2).toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
	if (src) {
		return (
			<img
				src={src}
				alt={name || "Avatar"}
				className={cn("rounded-full object-cover", sizeMap[size], className)}
			/>
		);
	}

	return (
		<div
			className={cn(
				"rounded-full inline-flex items-center justify-center font-medium",
				sizeMap[size],
				className,
			)}
			style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
			aria-label={name || "Avatar"}
		>
			{name ? initials(name) : <Icon name="user" size={iconSizeMap[size]} />}
		</div>
	);
}
