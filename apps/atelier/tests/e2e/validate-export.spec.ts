import { test, expect } from "./fixtures";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";

const EDITOR_URL = "/#/editor/e2e-test";
const OUTPUT_DIR = "/tmp/atelier-export-validation";

test.describe("Validate exported Ember app actually builds", () => {
  test("generate design, export files, verify build", async ({ page, context }) => {
    test.setTimeout(120_000);
    // Set up API key for mock
    await page.goto(EDITOR_URL);
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });
    await page.evaluate(() => {
      localStorage.setItem("atelier-api-key", "sk-ant-test-key-12345");
    });
    await page.reload();
    await page.waitForSelector(".atelier-app", { timeout: 15_000 });

    // Dismiss onboarding
    const blankCanvasBtn = page.locator(".onboarding-btn-scratch");
    if (
      await blankCanvasBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await blankCanvasBtn.click();
    }

    // Select Claude AI and generate a design
    await page.locator(".model-selector-btn").click();
    await page
      .locator(".model-dropdown-item", { hasText: "Claude AI" })
      .click();

    const promptInput = page.locator(".ai-prompt-input");
    await promptInput.fill("A landing page");
    await page.locator(".ai-prompt-send").click();

    await expect(page.locator(".status-elements")).toContainText("12 elements", {
      timeout: 10_000,
    });

    // Open export modal and switch to Ember App tab
    const exportBtn = page.locator("button", { hasText: /export/i });
    await exportBtn.first().click();
    const modal = page.locator(".export-modal");
    await expect(modal).toBeVisible();

    const appTab = modal.locator(".export-tab-app");
    await appTab.click();

    // Extract the generated file contents from the page
    const filesData = await page.evaluate(() => {
      // Access the modals component's emberAppFiles via the export preview
      // The preview code contains all files concatenated with // ── filename ── markers
      const previewEl = document.querySelector(
        ".export-highlighted-code",
      ) as HTMLElement;
      if (!previewEl) return null;

      const previewText = previewEl.textContent ?? "";

      // Parse the concatenated preview back into individual files
      const files: Record<string, string> = {};
      const sections = previewText.split(/\/\/ ── /);

      for (const section of sections) {
        if (!section.trim()) continue;
        const firstNewline = section.indexOf("\n");
        if (firstNewline === -1) continue;

        // Extract filename from the "── path ────" marker
        const header = section.substring(0, firstNewline);
        const path = header.replace(/\s*─+\s*$/, "").trim();
        const content = section.substring(firstNewline + 1);

        if (path) {
          files[path] = content;
        }
      }

      return files;
    });

    expect(filesData).not.toBeNull();
    expect(Object.keys(filesData!).length).toBeGreaterThan(5);

    // Write files to disk
    if (existsSync(OUTPUT_DIR)) {
      execSync(`rm -rf ${OUTPUT_DIR}`);
    }

    for (const [path, content] of Object.entries(filesData!)) {
      const fullPath = join(OUTPUT_DIR, path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
    }

    // Verify critical files exist
    expect(existsSync(join(OUTPUT_DIR, "package.json"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "vite.config.mjs"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "babel.config.cjs"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "app/app.ts"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "app/router.ts"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "app/config/environment.js"))).toBe(
      true,
    );
    expect(existsSync(join(OUTPUT_DIR, "config/environment.js"))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, "index.html"))).toBe(true);

    // Verify package.json has critical deps
    const pkgJson = JSON.parse(
      require("fs").readFileSync(
        join(OUTPUT_DIR, "package.json"),
        "utf-8",
      ),
    );
    expect(pkgJson.exports).toBeDefined();
    expect(pkgJson.dependencies["ember-source"]).toBeDefined();
    expect(pkgJson.devDependencies["decorator-transforms"]).toBeDefined();
    expect(pkgJson.devDependencies["ember-load-initializers"]).toBeDefined();
    expect(pkgJson.devDependencies["@embroider/config-meta-loader"]).toBeDefined();

    // Verify babel.config.cjs has decorator-transforms
    const babelConfig = require("fs").readFileSync(
      join(OUTPUT_DIR, "babel.config.cjs"),
      "utf-8",
    );
    expect(babelConfig).toContain("decorator-transforms");
    expect(babelConfig).toContain("ember-template-compilation");

    // Verify app/config/environment.js uses meta loader
    const appEnv = require("fs").readFileSync(
      join(OUTPUT_DIR, "app/config/environment.js"),
      "utf-8",
    );
    expect(appEnv).toContain("@embroider/config-meta-loader");

    // Verify route templates are .gts (Ember template-tag format)
    const templateFiles = Object.keys(filesData!).filter((f) =>
      f.startsWith("app/templates/"),
    );
    for (const tf of templateFiles) {
      expect(tf).toMatch(/\.gts$/);
    }

    // Try to install and build
    // This is the real validation — does pnpm install && pnpm build actually work?
    try {
      console.log("Running pnpm install...");
      execSync("pnpm install --no-frozen-lockfile", {
        cwd: OUTPUT_DIR,
        timeout: 120_000,
        stdio: "pipe",
      });
      console.log("pnpm install succeeded");

      console.log("Running pnpm build...");
      execSync("pnpm build", {
        cwd: OUTPUT_DIR,
        timeout: 120_000,
        stdio: "pipe",
      });
      console.log("pnpm build succeeded — exported app is valid!");
    } catch (e: unknown) {
      const err = e as { stderr?: Buffer; stdout?: Buffer };
      const stderr = err.stderr?.toString() ?? "";
      const stdout = err.stdout?.toString() ?? "";
      console.error("Build failed:", stderr.slice(-2000));
      console.error("Stdout:", stdout.slice(-1000));
      // Hard failure — the exported app MUST build
      throw new Error(
        `Exported Ember app failed to build:\n${stderr.slice(-1000)}`,
      );
    }

    // Serve the built app and verify it renders in a browser
    const { createServer } = await import("http");
    const { readFileSync: readF, existsSync: existsF } = await import("fs");
    const { join: joinP, extname } = await import("path");
    const { chromium } = await import("@playwright/test");

    const distDir = join(OUTPUT_DIR, "dist");
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
    };

    const server = createServer((req, res) => {
      let url = req.url ?? "/";
      if (url === "/") url = "/index.html";
      url = url.replace(/^\/\.\//, "/");
      const filePath = joinP(distDir, url);
      if (existsF(filePath)) {
        const ext = extname(filePath);
        res.writeHead(200, {
          "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
        });
        res.end(readF(filePath));
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readF(joinP(distDir, "index.html")));
      }
    });

    await new Promise<void>((resolve) => server.listen(4567, resolve));

    try {
      // Use a FRESH browser context — the test fixture's API mock
      // must not interfere with the exported app
      const browser = await chromium.launch();
      const freshContext = await browser.newContext();
      const appPage = await freshContext.newPage();

      // Collect console errors
      const errors: string[] = [];
      appPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const response = await appPage.goto("http://localhost:4567", {
        timeout: 15_000,
        waitUntil: "networkidle",
      });

      expect(response?.status()).toBe(200);

      // Wait for Ember to boot — look for the ember-application class or any div content
      try {
        await appPage.waitForSelector(".ember-application, .min-h-screen, div[id]", {
          timeout: 10_000,
        });
      } catch {
        // May not find it — let's check what we got
      }

      const bodyHTML = await appPage.evaluate(
        () => document.body.innerHTML,
      );
      const bodyText = await appPage.evaluate(
        () => document.body.innerText,
      );
      const allErrors = [...errors];
      // Also check for errors that happened during boot
      const pageErrors = await appPage.evaluate(() => {
        return (window as unknown as Record<string, string[]>).__emberErrors ?? [];
      });

      console.log("Rendered body length:", bodyHTML.length, "chars");
      console.log("Body text:", JSON.stringify(bodyText.slice(0, 300)));
      console.log("Body HTML:", JSON.stringify(bodyHTML.slice(0, 1000)));
      console.log("Console errors:", allErrors.length ? allErrors.join("\n") : "none");

      // The exported app must render actual component content
      expect(bodyHTML).toContain("relative");
      expect(bodyHTML.length).toBeGreaterThan(50);

      // No fatal JS errors
      expect(allErrors.filter(e => !e.includes("favicon")).length).toBe(0);

      await appPage.close();
      await freshContext.close();
      await browser.close();
    } finally {
      server.close();
    }
  });
});
