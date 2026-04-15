import { test, expect } from "@playwright/test";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Export functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding if it appears
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await blankCanvasBtn.click();
    }

    // Draw a rectangle so there's something to export
    await page.keyboard.press("r");
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 5 });
    await page.mouse.up();

    // Verify element was created
    await expect(page.locator(".status-elements")).toContainText("1 elements");
  });

  test("can open export modal from topbar", async ({ page }) => {
    // Look for the export button in the topbar
    // The topbar has an export action triggered by @onOpenExport
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    // Export modal should appear
    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Should show "Export Design" title
    await expect(modal.locator(".export-modal-title")).toHaveText("Export Design");
  });

  test("export modal shows format tabs including Ember", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Check format tabs exist
    const tabs = modal.locator(".export-tab");
    await expect(tabs).toHaveCount(7); // SVG, Ember, Tailwind, React, SwiftUI, HTML, Ember App

    // Verify specific format labels
    await expect(modal.locator(".export-tab-label", { hasText: "SVG" })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: /^Ember$/ })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: "Tailwind" })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: "React" })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: "SwiftUI" })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: "HTML" })).toBeVisible();
    await expect(modal.locator(".export-tab-label", { hasText: "Ember App" })).toBeVisible();
  });

  test("can switch to Ember export tab", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Click the Ember tab
    const emberTab = modal.locator(".export-tab:not(.export-tab-app)", { hasText: "Ember" });
    await emberTab.click();

    // The Ember tab should now be active
    await expect(emberTab).toHaveClass(/active/);

    // Should show .gts extension
    await expect(emberTab.locator(".export-tab-ext")).toHaveText(".gts");
  });

  test("SVG tab is active by default and shows code", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // SVG should be the default active tab
    const svgTab = modal.locator(".export-tab", { hasText: "SVG" });
    await expect(svgTab).toHaveClass(/active/);

    // Code preview should be visible
    const codeContainer = modal.locator(".export-code-container");
    await expect(codeContainer).toBeVisible();
  });

  test("can close export modal", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Close via the X button
    const closeBtn = modal.locator(".ai-modal-close");
    await closeBtn.click();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test("can switch to Ember App tab and see file list", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    // Click the Ember App tab
    const appTab = modal.locator(".export-tab-app");
    await appTab.click();
    await expect(appTab).toHaveClass(/active/);

    // Should show the app panel with file list
    await expect(modal.locator(".export-app-badge")).toHaveText("FULL APP");
    await expect(modal.locator(".export-app-file")).not.toHaveCount(0);

    // Should show the download button
    await expect(modal.locator(".export-btn-app")).toContainText("Download Ember App");
  });

  test("Ember App export includes essential files", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    const appTab = modal.locator(".export-tab-app");
    await appTab.click();

    // Check essential files are listed
    const filePaths = modal.locator(".export-app-file-path");
    const paths = await filePaths.allTextContents();
    expect(paths).toContain("package.json");
    expect(paths).toContain("vite.config.mjs");
    expect(paths).toContain("app/app.ts");
    expect(paths).toContain("app/router.ts");
    expect(paths).toContain("index.html");

    // Should have at least one component and one route template
    const hasComponent = paths.some((p) => p.includes("app/components/"));
    const hasTemplate = paths.some((p) => p.includes("app/templates/"));
    expect(hasComponent).toBe(true);
    expect(hasTemplate).toBe(true);
  });

  test("can close export modal with Escape", async ({ page }) => {
    const exportButton = page.locator("button", { hasText: /export/i });
    await exportButton.first().click();

    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible();
  });
});
