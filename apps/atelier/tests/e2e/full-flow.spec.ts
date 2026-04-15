import { test, expect } from "./fixtures";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Full design-to-export flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Set API key after page is on the right origin
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
    });

    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }
  });

  test("generate design → view in conversation mode → export Ember app", async ({
    page,
  }) => {
    // Reload so the service picks up the API key from localStorage
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });
    const blankCanvasBtnReload = page.locator(".onboarding-btn-scratch");
    if (await blankCanvasBtnReload.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await blankCanvasBtnReload.click();
    }

    // Step 1: Select Claude AI model
    await page.locator(".model-selector-btn").click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // Step 2: Generate a design
    const promptInput = page.locator(".ai-prompt-input");
    await promptInput.fill("A landing page with hero and CTA");
    await page.locator(".ai-prompt-send").click();

    // Wait for generation (mock returns 5 elements)
    await expect(page.locator(".status-elements")).toContainText("12 elements", {
      timeout: 10_000,
    });

    // Step 3: Toggle conversation mode
    const convBtn = page.locator(".conv-mode-btn");
    await convBtn.click();
    await expect(page.locator(".conv-chat-panel")).toBeVisible();
    await expect(page.locator(".conv-msg-user")).toBeVisible();

    // Step 4: Toggle back to canvas
    await convBtn.click();
    await expect(page.locator(".toolbar")).toBeVisible();

    // Step 5: Open export modal
    const exportBtn = page.locator("button", { hasText: /export/i });
    await exportBtn.first().click();
    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Step 6: Check all export tabs work
    // SVG (default)
    await expect(
      modal.locator(".export-tab", { hasText: "SVG" }),
    ).toHaveClass(/active/);

    // Ember component
    const emberTab = modal.locator(".export-tab:not(.export-tab-app)", {
      hasText: "Ember",
    });
    await emberTab.click();
    await expect(emberTab).toHaveClass(/active/);

    // Ember App
    const appTab = modal.locator(".export-tab-app");
    await appTab.click();
    await expect(appTab).toHaveClass(/active/);

    // Verify file list
    const filePaths = modal.locator(".export-app-file-path");
    const paths = await filePaths.allTextContents();
    expect(paths.length).toBeGreaterThan(5);
    expect(paths).toContain("package.json");
    expect(paths).toContain("app/router.ts");

    // Download button should be available
    await expect(modal.locator(".export-btn-app")).toContainText(
      "Download Ember App",
    );
  });

  test("command palette has AI and export commands", async ({ page }) => {
    // Open command palette
    await page.keyboard.press("Meta+k");
    const palette = page.locator(".cmd-palette");
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Search for "ember"
    const input = palette.locator("input");
    await input.fill("ember");

    // Should find Ember-related commands
    const items = palette.locator(".cmd-item");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Check that Ember App export is in results
    const texts = await items.allTextContents();
    const hasEmberApp = texts.some((t) =>
      t.toLowerCase().includes("ember app"),
    );
    expect(hasEmberApp).toBe(true);

    // Close palette
    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible();
  });

  test("keyboard shortcuts work in sequence", async ({ page }) => {
    // Draw a rectangle
    await page.keyboard.press("r");
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 350, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator(".status-elements")).toContainText("1 elements");

    // Select it
    await page.keyboard.press("v");
    await page.mouse.click(box.x + 300, box.y + 275);

    // Duplicate
    await page.keyboard.press("Meta+d");
    await expect(page.locator(".status-elements")).toContainText("2 elements");

    // Toggle to conversation mode and back
    await page.keyboard.press("Meta+j");
    await expect(page.locator(".conv-chat-panel")).toBeVisible();

    await page.keyboard.press("Meta+j");
    await expect(page.locator(".toolbar")).toBeVisible();

    // Elements should still be there
    await expect(page.locator(".status-elements")).toContainText("2 elements");
  });
});
