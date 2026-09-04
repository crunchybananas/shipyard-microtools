#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = resolve(repoRoot, 'docs');

const EXPECTED_DEMO_COUNT = 31;
// `the-island` is being developed independently. `before-after` is a support
// page crawled separately; `ember` and `morphogen` are generated/ignored build
// output, not canonical source demos.
const EXCLUDED_DEMO_DIRECTORIES = new Set(['before-after', 'ember', 'morphogen', 'the-island']);
const SUPPORT_PAGES = [
  { name: 'before-after', path: '/before-after/index.html' },
  { name: 'before-after-orbital-strike', path: '/before-after/orbital-strike/index.html' },
  { name: 'before-after-demo-hub', path: '/before-after/demo-hub/index.html' },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const OVERFLOW_TOLERANCE_PX = 2;

// Fathom deliberately animates a 200%-wide sea-surface wave while declaring
// overflow-x: clip. Chromium still includes that decorative SVG geometry in the
// root scrollWidth. Keep this exception narrow: it applies only while the clip
// declaration and approximately 200%-wide wave are both present, and while the
// measured excess stays within these current bounds.
const FATHOM_OVERFLOW_ALLOWANCE = {
  desktop: 24,
  mobile: 420,
};

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function discoverDemoNames() {
  const trackedIndexes = execFileSync(
    'git',
    ['ls-files', '--', 'docs/*/index.html'],
    { cwd: repoRoot, encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter(Boolean);

  const names = trackedIndexes
    .map(path => path.split('/')[1])
    .filter(name => name && !EXCLUDED_DEMO_DIRECTORIES.has(name))
    .sort();

  if (names.length !== EXPECTED_DEMO_COUNT) {
    const summary = `${names.length}: ${names.join(', ')}`;
    throw new Error(
      `Expected ${EXPECTED_DEMO_COUNT} tracked canonical demos after exclusions, found ${summary}`,
    );
  }

  return names;
}

function contentType(path) {
  return MIME_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream';
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';

      const relativePath = pathname.replace(/^\/+/, '');
      const filePath = resolve(docsRoot, relativePath);
      if (filePath !== docsRoot && !filePath.startsWith(`${docsRoot}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': fileStat.size,
        'Content-Type': contentType(filePath),
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filePath)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch (error) {
      const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 500;
      response.writeHead(status).end(status === 404 ? 'Not found' : 'Server error');
    }
  });
}

async function listen(server, port) {
  await new Promise((resolveListen, rejectListen) => {
    const onError = error => rejectListen(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolveListen();
    });
  });
}

async function closeServer(server) {
  await new Promise((resolveClose, rejectClose) => {
    server.close(error => (error ? rejectClose(error) : resolveClose()));
  });
}

function normalizeOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`DEMOS_BASE_URL must use http or https, received ${url.protocol}`);
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(url.hostname)) {
    throw new Error(`DEMOS_BASE_URL must point to a loopback host, received ${url.hostname}`);
  }
  return url.origin;
}

async function serverMatchesCurrentDocs(origin, expectedHubHtml) {
  try {
    const response = await fetch(`${origin}/index.html`, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok && (await response.text()) === expectedHubHtml;
  } catch {
    return false;
  }
}

async function ensureStaticServer() {
  const expectedHubHtml = await readFile(resolve(docsRoot, 'index.html'), 'utf8');
  const requestedOrigin = process.env.DEMOS_BASE_URL?.trim();
  if (requestedOrigin) {
    const origin = normalizeOrigin(requestedOrigin);
    if (!(await serverMatchesCurrentDocs(origin, expectedHubHtml))) {
      throw new Error(`DEMOS_BASE_URL does not serve the current docs tree: ${origin}`);
    }
    return { origin, mode: 'reused', stop: async () => {} };
  }

  const requestedPort = process.env.DEMOS_PORT ? Number(process.env.DEMOS_PORT) : 0;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
    throw new Error(`DEMOS_PORT must be an integer from 0 to 65535, received ${process.env.DEMOS_PORT}`);
  }

  if (requestedPort > 0) {
    const origin = `http://127.0.0.1:${requestedPort}`;
    if (await serverMatchesCurrentDocs(origin, expectedHubHtml)) {
      return { origin, mode: 'reused', stop: async () => {} };
    }
  }

  const server = createStaticServer();
  await listen(server, requestedPort);
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Static server did not expose a TCP address');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    mode: 'started',
    stop: () => closeServer(server),
  };
}

function isLocalUrl(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function unique(items) {
  return [...new Set(items)];
}

async function inspectPage(browser, serverOrigin, pageDefinition, viewport) {
  const page = await browser.newPage({
    serviceWorkers: 'block',
    viewport: { width: viewport.width, height: viewport.height },
  });
  const consoleErrors = [];
  const pageErrors = [];
  const localHttpErrors = [];
  const localRequestFailures = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (isLocalUrl(response.url(), serverOrigin) && response.status() >= 400) {
      localHttpErrors.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('requestfailed', request => {
    if (isLocalUrl(request.url(), serverOrigin)) {
      localRequestFailures.push(
        `${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? 'unknown failure'}`,
      );
    }
  });

  let mainStatus = null;
  let navigationError = null;
  let metrics = null;
  try {
    const response = await page.goto(`${serverOrigin}${pageDefinition.path}`, {
      timeout: 15_000,
      waitUntil: 'load',
    });
    mainStatus = response?.status() ?? null;
    await page.waitForTimeout(250);
    metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const clientWidth = root.clientWidth;
      const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth ?? 0);
      const fathomWave = document.querySelector('#sky > .wave');

      return {
        bodyHasContent: Boolean(body && (body.childElementCount > 0 || body.textContent.trim())),
        bodyPresent: Boolean(body),
        bodyOverflowX: body ? getComputedStyle(body).overflowX : null,
        clientWidth,
        fathomWaveWidth: fathomWave?.getBoundingClientRect().width ?? null,
        horizontalOverflow: Math.max(0, scrollWidth - clientWidth),
        titlePresent: Boolean(document.title.trim()),
      };
    });
  } catch (error) {
    navigationError = error.message.split('\n')[0];
  } finally {
    await page.close();
  }

  const overflow = metrics?.horizontalOverflow ?? null;
  const fathomLimit = FATHOM_OVERFLOW_ALLOWANCE[viewport.name];
  const fathomException =
    pageDefinition.name === 'fathom' &&
    overflow !== null &&
    overflow > OVERFLOW_TOLERANCE_PX &&
    overflow <= fathomLimit &&
    metrics.bodyOverflowX === 'clip' &&
    metrics.fathomWaveWidth >= metrics.clientWidth * 1.9 &&
    metrics.fathomWaveWidth <= metrics.clientWidth * 2.1;

  const issues = [];
  if (navigationError) issues.push(`navigation: ${navigationError}`);
  if (mainStatus === null || mainStatus >= 400) issues.push(`main HTTP status: ${mainStatus ?? 'none'}`);
  if (!metrics?.titlePresent) issues.push('missing document title');
  if (!metrics?.bodyPresent) issues.push('missing body element');
  else if (!metrics.bodyHasContent) issues.push('empty body');
  if (overflow !== null && overflow > OVERFLOW_TOLERANCE_PX && !fathomException) {
    issues.push(`horizontal overflow: ${overflow}px`);
  }
  issues.push(...unique(localHttpErrors).map(error => `local HTTP: ${error}`));
  issues.push(...unique(localRequestFailures).map(error => `local request failed: ${error}`));
  issues.push(...unique(pageErrors).map(error => `pageerror: ${error}`));
  issues.push(...unique(consoleErrors).map(error => `console: ${error}`));

  return {
    fathomException,
    issues,
    mainStatus,
    metrics,
    page: pageDefinition.name,
    viewport: viewport.name,
  };
}

function table(rows) {
  const headers = ['page', 'HTTP D/M', 'content D/M', 'overflow D/M', 'errors', 'result'];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map(row => String(row[index]).length)),
  );
  const render = row => row.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
  return [render(headers), render(widths.map(width => '-'.repeat(width))), ...rows.map(render)].join('\n');
}

function summarize(pageDefinitions, results) {
  const rows = pageDefinitions.map(pageDefinition => {
    const desktop = results.find(result => result.page === pageDefinition.name && result.viewport === 'desktop');
    const mobile = results.find(result => result.page === pageDefinition.name && result.viewport === 'mobile');
    const pair = [desktop, mobile];
    const issueCount = pair.reduce((sum, result) => sum + result.issues.length, 0);
    const content = pair
      .map(result => (result.metrics?.titlePresent && result.metrics?.bodyHasContent ? 'ok' : 'bad'))
      .join('/');
    const overflow = pair
      .map(result => {
        const amount = result.metrics?.horizontalOverflow;
        if (amount === null || amount === undefined) return '?';
        return `${amount}${result.fathomException ? '*' : ''}`;
      })
      .join('/');

    return [
      pageDefinition.name,
      pair.map(result => result.mainStatus ?? '-').join('/'),
      content,
      overflow,
      issueCount,
      issueCount === 0 ? 'PASS' : 'FAIL',
    ];
  });

  console.log(table(rows));
  console.log('\nD/M = desktop/mobile; overflow is excess CSS pixels.');
  if (results.some(result => result.fathomException)) {
    console.log('* Fathom allowance: non-scrollable, overflow-x-clipped 200%-wide decorative sea wave.');
  }

  const failures = results.filter(result => result.issues.length > 0);
  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const failure of failures) {
      console.error(`- ${failure.page} (${failure.viewport})`);
      for (const issue of failure.issues) console.error(`  - ${issue}`);
    }
  }
  return failures.length;
}

async function main() {
  const demoNames = discoverDemoNames();
  const pages = [
    { name: 'hub', path: '/index.html' },
    ...demoNames.map(name => ({ name, path: `/${name}/index.html` })),
    ...SUPPORT_PAGES,
  ];
  const staticServer = await ensureStaticServer();
  const crawlSummary = `${pages.length} pages at ${VIEWPORTS.length} viewports`;
  console.log(
    `[demos:test] ${staticServer.mode} static server at ${staticServer.origin}; crawling ${crawlSummary}\n`,
  );

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const page of pages) {
      for (const viewport of VIEWPORTS) {
        results.push(await inspectPage(browser, staticServer.origin, page, viewport));
      }
    }

    const failureCount = summarize(pages, results);
    if (failureCount > 0) {
      console.error(`\n[demos:test] FAIL — ${failureCount} of ${results.length} viewport crawls failed.`);
      process.exitCode = 1;
    } else {
      console.log(
        `\n[demos:test] PASS — hub + ${demoNames.length} tracked demos + ${SUPPORT_PAGES.length} support pages (${results.length} viewport crawls).`,
      );
    }
  } finally {
    await browser?.close();
    await staticServer.stop();
  }
}

main().catch(error => {
  console.error(`[demos:test] ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
