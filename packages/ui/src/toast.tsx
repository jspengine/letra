import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import type { IconName } from "./icon";

type ToastType = "success" | "error" | "info" | "agent";

interface ToastAction {
	label: string;
	onClick: () => void;
}

interface Toast {
	id: number;
	message: string;
	type: ToastType;
	action?: ToastAction;
}

interface ToastOptions {
	type?: ToastType;
	action?: ToastAction;
	duration?: number;
}

interface ToastContextValue {
	toast: (message: string, type?: ToastType) => void;
	toastWithOptions: (message: string, options?: ToastOptions) => void;
}

const toastTokenMap: Record<ToastType, string> = {
	success: "color-success",
	error: "color-danger",
	info: "color-info",
	agent: "color-agent",
};

const toastIconMap: Record<ToastType, IconName> = {
	success: "circle-check",
	error: "circle-x",
	info: "info",
	agent: "sparkles",
};

const ToastContext = createContext<ToastContextValue>({
	toast: () => {},
	toastWithOptions: () => {},
});

export function useToast() {
	return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

	const removeToast = useCallback((id: number) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
		const timer = timersRef.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timersRef.current.delete(id);
		}
	}, []);

	const addToast = useCallback(
		(message: string, type: ToastType = "info") => {
			const id = ++toastId;
			setToasts((prev) => [...prev, { id, message, type }]);
			const timer = setTimeout(() => removeToast(id), 3000);
			timersRef.current.set(id, timer);
		},
		[removeToast],
	);

	const addToastWithOptions = useCallback(
		(message: string, options?: ToastOptions) => {
			const id = ++toastId;
			setToasts((prev) => [
				...prev,
				{
					id,
					message,
					type: options?.type ?? "info",
					action: options?.action,
				},
			]);
			const timer = setTimeout(() => removeToast(id), options?.duration ?? 3000);
			timersRef.current.set(id, timer);
		},
		[removeToast],
	);

	return (
		<ToastContext.Provider value={{ toast: addToast, toastWithOptions: addToastWithOptions }}>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-[var(--space-2)]">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className="flex max-w-sm items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border-[length:var(--border-thin)] px-[var(--space-4)] py-[var(--space-3)] text-body font-medium shadow-lg animate-slide-in-right"
						style={{
							background: "var(--color-bg-surface)",
							color: "var(--color-text-primary)",
							borderColor: `color-mix(in srgb, var(--${toastTokenMap[toast.type]}) 35%, var(--color-border))`,
						}}
					>
						<Icon name={toastIconMap[toast.type]} size={18} style={{ color: `var(--${toastTokenMap[toast.type]})` }} />
						<span className="flex-1">{toast.message}</span>
						{toast.action && (
							<Button
								type="button"
								size="sm"
								variant={toast.type === "error" ? "danger" : "secondary"}
								className="shrink-0"
								onClick={() => {
									toast.action?.onClick();
									removeToast(toast.id);
								}}
							>
								{toast.action.label}
							</Button>
						)}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
