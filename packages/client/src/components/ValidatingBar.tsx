import { cn } from "../lib/utils";

interface ValidatingBarProps {
	active: boolean;
}

export function ValidatingBar({ active }: ValidatingBarProps) {
	return (
		<div
			className={cn(
				"fixed top-0 left-0 right-0 h-0.5 z-50 transition-opacity duration-300",
				active ? "opacity-100" : "opacity-0 pointer-events-none",
			)}
			aria-hidden="true"
		>
			<div className="h-full w-full bg-[var(--primary)] rounded-full animate-validating-bar" />
		</div>
	);
}
