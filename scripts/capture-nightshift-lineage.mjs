#!/usr/bin/env node
// Photograph fresh app states from pinned source commits, never reconstructed UI.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  stat,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "@playwright/test"
);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gitRoot = resolve(process.env.CAPTURE_REPO || root),
  archive = resolve(root, "docs/before-after");
const slug = "synth-nightshift-astra",
  story = JSON.parse(
    await readFile(resolve(archive, "stories", `${slug}.json`), "utf8"),
  );
if (story.status === "published" && !process.env.CAPTURE_OUTPUT_DIR)
  throw new Error("Published evidence is immutable. Set CAPTURE_OUTPUT_DIR.");
const directory = process.env.CAPTURE_OUTPUT_DIR
  ? resolve(process.env.CAPTURE_OUTPUT_DIR, slug)
  : resolve(archive, "assets", slug);
await mkdir(directory, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), "nightshift-capture-"));
const git = (args) =>
  execFileSync("git", args, {
    cwd: gitRoot,
    env: { ...process.env, GIT_WORK_TREE: gitRoot },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const server = createServer(async (req, res) => {
  try {
    let path = resolve(
      scratch,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!path.startsWith(scratch + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`,
  browser = await chromium.launch({ headless: true });
const captures = [];
try {
  for (const version of story.lineage) {
    const commit = git(["rev-parse", `${version.commit}^{commit}`])
        .toString()
        .trim(),
      snapshot = resolve(scratch, version.id);
    await mkdir(snapshot);
    const paths = ["docs/synth-studio"];
    try {
      git(["cat-file", "-e", `${commit}:docs/shared`]);
      paths.push("docs/shared");
    } catch {}
    execFileSync("tar", ["-x", "-C", snapshot], {
      input: git(["archive", commit, ...paths]),
    });
    for (const scene of story.comparisons) {
      const page = await browser.newPage({
          viewport: scene.viewport,
          deviceScaleFactor: 1,
          colorScheme: "dark",
          reducedMotion: "reduce",
        }),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/${version.id}/docs/synth-studio/`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      const filename = `${version.id}-${scene.id}.jpg`,
        bytes = await page.screenshot({
          path: resolve(directory, filename),
          type: "jpeg",
          quality: 92,
          animations: "disabled",
        });
      const state = await page.evaluate(() => ({
        scrollX,
        scrollY,
        title: document.title,
        audioState: window.Nightshift?.snapshot().audioState || "not activated",
      }));
      if (errors.length)
        throw new Error(`${version.id}/${scene.id}: ${errors.join("; ")}`);
      captures.push({
        version: version.id,
        commit,
        scene: scene.id,
        filename,
        viewport: scene.viewport,
        deviceScaleFactor: 1,
        browser: browser.version(),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        ...state,
      });
      await page.close();
    }
  }
  await writeFile(
    resolve(directory, "capture-receipt.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        fixture:
          "scripts/capture-nightshift-lineage.mjs; fresh page, empty local storage, audio stopped",
        captures,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${slug}: ${captures.length} authentic desktop/mobile captures from ${story.lineage.length} pinned revisions.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await rm(scratch, { recursive: true, force: true });
}
