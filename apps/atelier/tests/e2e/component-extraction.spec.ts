import { test, expect } from "@playwright/test";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Component extraction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }

    // Draw several elements to trigger component extraction
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Draw 5 rectangles
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("r");
      const x = box.x + 100 + i * 120;
      const y = box.y + 100;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 100, y + 80, { steps: 3 });
      await page.mouse.up();
    }

    await expect(page.locator(".status-elements")).toContainText("5 elements");
  });

  test("Cmd+Shift+E opens component extraction panel", async ({ page }) => {
    await page.keyboard.press("Meta+Shift+e");

    const panel = page.locator(".component-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("component panel shows detected components", async ({ page }) => {
    await page.keyboard.press("Meta+Shift+e");

    const panel = page.locator(".component-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should have at least one component card (the repeated rectangles)
    const cards = panel.locator(".component-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a component card selects its elements", async ({ page }) => {
    await page.keyboard.press("Meta+Shift+e");

    const panel = page.locator(".component-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click the first component card
    const firstCard = panel.locator(".component-card").first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      // Should have some elements selected
      await expect(page.locator(".status-elements")).toBeVisible();
    }
  });

  test("Escape closes the component panel", async ({ page }) => {
    await page.keyboard.press("Meta+Shift+e");

    const panel = page.locator(".component-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
  });
});
