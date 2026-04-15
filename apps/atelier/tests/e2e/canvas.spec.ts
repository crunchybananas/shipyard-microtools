import { test, expect } from "@playwright/test";

const EDITOR_URL = "/#/editor/e2e-test";

test.describe("Canvas interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding if it appears (click "Start with a blank canvas")
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await blankCanvasBtn.click();
    }
  });

  test("can select rectangle tool via toolbar button", async ({ page }) => {
    // The rectangle button is the 3rd tool-btn (after select, frame)
    const rectBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Rectangle"))');
    await rectBtn.click();
    await expect(rectBtn).toHaveClass(/active/);
  });

  test("can select ellipse tool via toolbar button", async ({ page }) => {
    const ellipseBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Ellipse"))');
    await ellipseBtn.click();
    await expect(ellipseBtn).toHaveClass(/active/);
  });

  test("can select text tool via toolbar button", async ({ page }) => {
    const textBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Text"))');
    await textBtn.click();
    await expect(textBtn).toHaveClass(/active/);
  });

  test("can select tools via keyboard shortcuts", async ({ page }) => {
    // Press R for rectangle
    await page.keyboard.press("r");
    const rectBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Rectangle"))');
    await expect(rectBtn).toHaveClass(/active/);

    // Press O for ellipse
    await page.keyboard.press("o");
    const ellipseBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Ellipse"))');
    await expect(ellipseBtn).toHaveClass(/active/);

    // Press V for select
    await page.keyboard.press("v");
    const selectBtn = page.locator('.tool-btn:has(.tool-tooltip:has-text("Select"))');
    await expect(selectBtn).toHaveClass(/active/);
  });

  test("can draw a rectangle on the canvas", async ({ page }) => {
    // Select rectangle tool
    await page.keyboard.press("r");

    // Draw on the canvas by dragging
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 80, { steps: 5 });
    await page.mouse.up();

    // An element should now exist — check the status bar element count
    await expect(page.locator(".status-elements")).toContainText("1 elements");

    // The element should appear in the layers panel
    const layerItems = page.locator(".layer-item");
    await expect(layerItems).toHaveCount(1);
  });

  test("can draw multiple shapes and see them in layers", async ({ page }) => {
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Draw a rectangle
    await page.keyboard.press("r");
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180, { steps: 5 });
    await page.mouse.up();

    // Draw an ellipse
    await page.keyboard.press("o");
    await page.mouse.move(box.x + 300, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 180, { steps: 5 });
    await page.mouse.up();

    // Should show 2 elements
    await expect(page.locator(".status-elements")).toContainText("2 elements");
    await expect(page.locator(".layer-item")).toHaveCount(2);
  });

  test("can delete an element", async ({ page }) => {
    // Draw a rectangle
    await page.keyboard.press("r");
    const canvas = page.locator(".canvas-svg");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 80, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator(".status-elements")).toContainText("1 elements");

    // Select the element by clicking on it
    await page.keyboard.press("v");
    await page.mouse.click(box.x + box.width / 2 + 50, box.y + box.height / 2 + 40);

    // Delete it
    await page.keyboard.press("Delete");

    await expect(page.locator(".status-elements")).toContainText("0 elements");
  });
});
