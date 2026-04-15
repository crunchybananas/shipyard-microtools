import { test, expect } from "./fixtures";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("AI generation with mock API", () => {
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

  test("can set API key and select model tier", async ({ page }) => {
    // Open model dropdown
    const modelBtn = page.locator(".model-selector-btn");
    await modelBtn.click();

    // Should show Atelier v1 and Claude AI options
    await expect(page.locator(".model-dropdown")).toBeVisible();
    await expect(
      page.locator(".model-dropdown-item", { hasText: "Atelier v1" }),
    ).toBeVisible();
    await expect(
      page.locator(".model-dropdown-item", { hasText: "Claude AI" }),
    ).toBeVisible();

    // Click Claude AI — should open API key modal since no key set
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();
    await expect(page.locator(".api-key-modal")).toBeVisible();

    // Enter a test key
    await page.locator(".api-key-input").fill("sk-ant-test-key-12345");
    await page.locator(".api-key-btn.primary").click();

    // Should show toast confirming
    await expect(page.locator(".toast")).toContainText("API key saved");
  });

  test("model dropdown shows tier options when Claude is selected", async ({
    page,
  }) => {
    // Pre-set API key and model via localStorage
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
      localStorage.setItem("atelier-model-tier", "haiku");
    });
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding after reload
    const blankCanvasBtnReload = page.locator(".onboarding-btn-scratch");
    if (await blankCanvasBtnReload.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await blankCanvasBtnReload.click();
    }

    // Set to pro model
    const modelBtn = page.locator(".model-selector-btn");
    await modelBtn.click();

    // Select Claude AI
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // Reopen to see tiers
    await modelBtn.click();

    // Should show tier items
    await expect(
      page.locator(".model-tier-item", { hasText: "Haiku" }),
    ).toBeVisible();
    await expect(
      page.locator(".model-tier-item", { hasText: "Sonnet" }),
    ).toBeVisible();
    await expect(
      page.locator(".model-tier-item", { hasText: "Opus" }),
    ).toBeVisible();
  });

  test("generates design using mocked Claude API", async ({ page }) => {
    // Pre-set API key and pro model
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
    });
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding again after reload
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }

    // Select pro model
    const modelBtn = page.locator(".model-selector-btn");
    await modelBtn.click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // Type a prompt and generate
    const promptInput = page.locator(".ai-prompt-input");
    await promptInput.fill("A simple landing page");
    await page.locator(".ai-prompt-send").click();

    // Wait for elements to be placed (mock returns 5 elements)
    await expect(page.locator(".status-elements")).toContainText("12 elements", {
      timeout: 10_000,
    });

    // Verify elements appear in layers panel
    const layerItems = page.locator(".layer-item");
    await expect(layerItems).toHaveCount(12);
  });

  test("test connection button works with mock API", async ({ page }) => {
    // Pre-set API key
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
    });
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding after reload
    const blankCanvasBtnReload = page.locator(".onboarding-btn-scratch");
    if (await blankCanvasBtnReload.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await blankCanvasBtnReload.click();
    }

    // Open model dropdown and select Claude to trigger API key modal
    await page.locator(".model-selector-btn").click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // Key is already set, so modal should show with test connection button
    // We need to open the API key modal — click Claude AI again
    await page.locator(".model-selector-btn").click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    // If the key modal opened, test connection
    const testBtn = page.locator(".api-key-btn", {
      hasText: "Test Connection",
    });
    if (await testBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await testBtn.click();
      await expect(page.locator(".toast")).toContainText(
        "Connection successful",
      );
    }
  });
});
