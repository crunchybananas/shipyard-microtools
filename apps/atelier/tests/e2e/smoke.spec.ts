import { test, expect } from "@playwright/test";

// The editor route requires a project_id param.
// Using a dummy id loads an empty project (no Firebase data),
// which is fine for verifying the UI shell renders.
const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    // Wait for the app shell to render
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });
  });

  test("app loads and main layout is visible", async ({ page }) => {
    // The top-level app container should exist
    await expect(page.locator(".atelier-app")).toBeVisible();
  });

  test("canvas SVG renders", async ({ page }) => {
    const canvas = page.locator(".canvas-svg");
    await expect(canvas).toBeVisible();
  });

  test("toolbar is visible with tool buttons", async ({ page }) => {
    const toolbar = page.locator(".toolbar");
    await expect(toolbar).toBeVisible();

    // Should have tool buttons for the core tools
    const toolButtons = toolbar.locator(".tool-btn");
    await expect(toolButtons).toHaveCount(8); // select, frame, rect, ellipse, line, text, pen, hand
  });

  test("layers panel is visible", async ({ page }) => {
    const layersPanel = page.locator(".layers-panel");
    await expect(layersPanel).toBeVisible();
  });

  test("status bar shows element count", async ({ page }) => {
    const statusBar = page.locator(".status-bar");
    await expect(statusBar).toBeVisible();
    await expect(statusBar.locator(".status-elements")).toContainText(
      "elements",
    );
  });

  test("zoom controls are visible", async ({ page }) => {
    const zoomControls = page.locator(".zoom-controls");
    await expect(zoomControls).toBeVisible();
    await expect(zoomControls.locator(".zoom-value")).toContainText("%");
  });
});
