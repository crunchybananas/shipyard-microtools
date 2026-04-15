import { test, expect } from "./fixtures";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Conversation mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding if it appears
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }
  });

  test("can toggle conversation mode via topbar button", async ({ page }) => {
    // Find the conversation mode toggle button
    const convBtn = page.locator(".conv-mode-btn");
    await expect(convBtn).toBeVisible();
    await expect(convBtn).toContainText("Chat");

    // Click to enter conversation mode
    await convBtn.click();

    // App should have conversation-mode class
    await expect(page.locator(".atelier-app")).toHaveClass(/conversation-mode/);

    // Chat panel should be visible
    await expect(page.locator(".conv-chat-panel")).toBeVisible();
    await expect(page.locator(".conv-chat-header")).toBeVisible();
    await expect(page.locator(".conv-preview-panel")).toBeVisible();

    // Button should now say "Canvas"
    await expect(convBtn).toContainText("Canvas");
  });

  test("can toggle back to canvas mode", async ({ page }) => {
    const convBtn = page.locator(".conv-mode-btn");
    await convBtn.click();
    await expect(page.locator(".conv-chat-panel")).toBeVisible();

    // Click again to go back
    await convBtn.click();
    await expect(page.locator(".atelier-app")).not.toHaveClass(
      /conversation-mode/,
    );

    // Toolbar should be back
    await expect(page.locator(".toolbar")).toBeVisible();
  });

  test("conversation mode shows prompt bar", async ({ page }) => {
    const convBtn = page.locator(".conv-mode-btn");
    await convBtn.click();

    // Prompt bar should be inside the chat panel
    await expect(page.locator(".conv-chat-panel .ai-prompt-bar")).toBeVisible();
  });

  test("can generate design in conversation mode with mock API", async ({
    page,
  }) => {
    // Pre-set API key
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
    });
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding after reload
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }

    // Enter conversation mode
    await page.locator(".conv-mode-btn").click();

    // Select pro model
    await page.locator(".model-selector-btn").click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // Type prompt and generate
    const promptInput = page.locator(".ai-prompt-input");
    await promptInput.fill("A landing page");
    await page.locator(".ai-prompt-send").click();

    // Wait for generation
    await expect(page.locator(".status-elements")).toContainText("12 elements", {
      timeout: 10_000,
    });

    // Conversation history should show the user message
    await expect(page.locator(".conv-msg-user")).toBeVisible();
  });

  test("preview panel has Canvas/HTML toggle tabs", async ({ page }) => {
    const convBtn = page.locator(".conv-mode-btn");
    await convBtn.click();

    // Should show preview tabs
    const tabs = page.locator(".conv-preview-tabs");
    await expect(tabs).toBeVisible();

    // Canvas tab should be active by default
    const canvasTab = page.locator(".conv-preview-tab", { hasText: "Canvas" });
    await expect(canvasTab).toHaveClass(/active/);

    // HTML tab should be available
    const htmlTab = page.locator(".conv-preview-tab", { hasText: "HTML" });
    await expect(htmlTab).toBeVisible();
  });

  test("can switch to HTML preview in conversation mode", async ({ page }) => {
    // Draw something first so HTML preview has content
    await page.keyboard.press("r");
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 350, { steps: 5 });
    await page.mouse.up();

    // Enter conversation mode
    await page.locator(".conv-mode-btn").click();

    // Switch to HTML preview
    const htmlTab = page.locator(".conv-preview-tab", { hasText: "HTML" });
    await htmlTab.click();
    await expect(htmlTab).toHaveClass(/active/);

    // Should show an iframe with HTML preview
    const iframe = page.locator(".conv-html-preview");
    await expect(iframe).toBeVisible();
  });

  test("keyboard shortcut Cmd+J toggles conversation mode", async ({
    page,
  }) => {
    // Enter via keyboard
    await page.keyboard.press("Meta+j");
    await expect(page.locator(".conv-chat-panel")).toBeVisible();

    // Exit via keyboard
    await page.keyboard.press("Meta+j");
    await expect(page.locator(".toolbar")).toBeVisible();
  });
});
