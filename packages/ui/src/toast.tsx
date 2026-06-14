import { type ReactNode, createContext, useCallback, useContext, useState } from "react";
import { cn } from "./utils";

type ToastType = "success" | "error" | "info";

interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

interface ToastContextValue {
	toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
	return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = useCallback((message: string, type: ToastType = "info") => {
		const id = ++toastId;
		setToasts((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3000);
	}, []);

	return (
		<ToastContext.Provider value={{ toast: addToast }}>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						key={t.id}
						className={cn(
							"px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-slide-in-right border",
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
									: "var(--success-foreground)",
							borderColor: "var(--border)",
						}}
					>
						{t.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
