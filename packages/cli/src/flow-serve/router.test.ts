import { describe, expect, it, vi } from "vitest";
import type { RequestContext } from "./request-context.js";
import { FlowServerRouter } from "./router.js";

describe("FlowServerRouter", () => {
	it("stops after the first route handler accepts the request", async () => {
		const router = new FlowServerRouter();
		const first = vi.fn().mockReturnValue(false);
		const owner = vi.fn().mockResolvedValue(true);
		const unreachable = vi.fn().mockReturnValue(true);
		router.register(first);
		router.register(owner);
		router.register(unreachable);

		await expect(router.dispatch({} as RequestContext)).resolves.toBe(true);
		expect(first).toHaveBeenCalledOnce();
		expect(owner).toHaveBeenCalledOnce();
		expect(unreachable).not.toHaveBeenCalled();
	});

	it("reports unowned requests", async () => {
		const router = new FlowServerRouter();
		router.register(() => false);
		await expect(router.dispatch({} as RequestContext)).resolves.toBe(false);
	});
});
