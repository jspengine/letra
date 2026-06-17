import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "./utils";

type ToastType = "success" | "error" | "info";

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
		setToasts((prev) => prev.filter((t) => t.id !== id));
		const timer = timersRef.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timersRef.current.delete(id);
		}
	}, []);

	const addToast = useCallback(
		(message: string, type: ToastType = "info") => {
			const id = ++toastId;
			const toastItem: Toast = { id, message, type };
			setToasts((prev) => [...prev, toastItem]);
			const timer = setTimeout(() => removeToast(id), 3000);
			timersRef.current.set(id, timer);
		},
		[removeToast],
	);

	const addToastWithOptions = useCallback(
		(message: string, options?: ToastOptions) => {
			const id = ++toastId;
			const toastItem: Toast = {
				id,
				message,
				type: options?.type ?? "info",
				action: options?.action,
			};
			setToasts((prev) => [...prev, toastItem]);
			const timer = setTimeout(() => removeToast(id), options?.duration ?? 3000);
			timersRef.current.set(id, timer);
		},
		[removeToast],
	);

	return (
		<ToastContext.Provider value={{ toast: addToast, toastWithOptions: addToastWithOptions }}>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						key={t.id}
						className={cn(
							"flex items-center gap-3 px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-slide-in-right border max-w-sm",
						)}
						style={{
							background:
								t.type === "success"
									? "var(--success)"
									: t.type === "error"
										? "var(--error)"
										: "var(--card)",
							color:
								t.type === "info"
									? "var(--card-foreground)"
									: "white",
							borderColor: "var(--border)",
						}}
					>
						<span className="flex-1">{t.message}</span>
						{t.action && (
							<button
								type="button"
								onClick={() => {
									t.action!.onClick();
									removeToast(t.id);
								}}
								className="shrink-0 text-xs font-bold px-2 py-1 rounded transition-colors hover:opacity-80"
								style={{
									background: t.type === "info" ? "var(--primary)" : "rgba(255,255,255,0.25)",
									color: t.type === "info" ? "var(--primary-foreground)" : "white",
								}}
							>
								{t.action.label}
							</button>
						)}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
