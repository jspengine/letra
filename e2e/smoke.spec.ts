import { test, expect } from "@playwright/test";

test("app loads and shows Letra logo in header", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("header")).toBeVisible();
	await expect(page.getByText("Letra")).toBeVisible();
});

test("shows workspace selector in sidebar", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("aside")).toBeVisible();
	await expect(page.getByText("Selecionar workspace")).toBeVisible();
});

test("can navigate to Meus Workspaces", async ({ page }) => {
	await page.goto("/");
	await page.locator("aside button").filter({ hasText: "Selecionar workspace" }).click();
	await page.getByRole("button", { name: "Gerenciar workspaces" }).click();
	await expect(page.getByText("Meus Workspaces")).toBeVisible();
});

test("sidebar tabs are disabled when no workspace", async ({ page }) => {
	await page.goto("/");
	const dashboardBtn = page.locator('aside button[role="tab"]').filter({ hasText: "Dashboard" });
	await expect(dashboardBtn).toBeDisabled();
});
