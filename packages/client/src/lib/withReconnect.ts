export function createEventSourceWithReconnect(url: string): EventSource {
	let es: EventSource;
	let closed = false;
	let retryDelay = 1000;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

	function addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		if (!listeners.has(type)) listeners.set(type, new Set());
		listeners.get(type)!.add(listener);
		es.addEventListener(type, listener);
	}

	function removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		listeners.get(type)?.delete(listener);
		es.removeEventListener(type, listener);
	}

	function close(): void {
		closed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		es.close();
	}

	function scheduleReconnect(): void {
		if (closed) return;
		console.warn(`[SSE] Reconnecting in ${retryDelay / 1000}s...`);
		reconnectTimer = setTimeout(() => {
			connect();
			retryDelay = Math.min(retryDelay * 2, 30000);
		}, retryDelay);
	}

	function connect(): void {
		if (closed) return;
		es = new EventSource(url);

		es.onopen = () => {
			retryDelay = 1000;
			console.warn("[SSE] Connected");
		};

		listeners.forEach((set, type) => {
			for (const listener of set) {
				es.addEventListener(type, listener);
			}
		});

		es.onerror = () => {
			es.close();
			scheduleReconnect();
		};
	}

	connect();

	return new Proxy<EventSource>({} as EventSource, {
		get(_, prop) {
			if (prop === "addEventListener") return addEventListener;
			if (prop === "removeEventListener") return removeEventListener;
			if (prop === "close") return close;
			return Reflect.get(es, prop);
		},
		set(_, prop, value) {
			return Reflect.set(es, prop, value);
		},
	});
}
