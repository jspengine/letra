import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
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
	const [items, setItems] = useState<ToastItem[]>([]);

	const toast = useCallback((message: string, type: ToastType = "info") => {
		const id = ++toastId;
		setItems((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setItems((prev) => prev.filter((t) => t.id !== id));
		}, 3000);
	}, []);

	return (
		<ToastContext.Provider value={{ toast }}>
			{children}
			<div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
				{items.map((item) => (
					<div
						key={item.id}
						className="px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-slide-in-right pointer-events-auto"
						style={{
							background: item.type === "success" ? "var(--success)" : item.type === "error" ? "var(--error)" : "var(--primary)",
							color: item.type === "success" ? "var(--success-foreground)" : item.type === "error" ? "var(--error-foreground)" : "var(--primary-foreground)",
						}}
					>
						{item.type === "success" ? "✓ " : item.type === "error" ? "✗ " : "ℹ "}
						{item.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
