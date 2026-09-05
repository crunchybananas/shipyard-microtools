#!/usr/bin/env node
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs/before-after');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const browser = await chromium.launch({ headless: true });
try {
  for (const slug of process.argv.slice(2)) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid story slug.');
    const story = JSON.parse(await readFile(resolve(root, 'stories', `${slug}.json`), 'utf8'));
    const destination = process.env.SHARE_OUTPUT_DIR ? resolve(process.env.SHARE_OUTPUT_DIR, slug) : resolve(root, 'assets', slug);
    if (story.status === 'published' && !process.env.SHARE_OUTPUT_DIR) throw new Error('Published assets are immutable. Set SHARE_OUTPUT_DIR.');
    await mkdir(destination, { recursive: true });
    const scene = story.comparisons.find(scene => scene.id === 'desktop');
    const figures = await Promise.all(story.lineage.map(async (version, index) => {
      const bytes = await readFile(resolve(root, scene.frames[version.id].src));
      return `<figure><figcaption><strong>${index + 1}. ${escape(version.label)}</strong><span>${escape(version.provenance.model || 'Model unrecorded')} · ${version.commit.slice(0, 8)}</span></figcaption><img src="data:image/jpeg;base64,${bytes.toString('base64')}" alt="${escape(scene.frames[version.id].alt)}"></figure>`;
    }));
    for (const type of ['social', 'montage']) {
      const viewport = type === 'social' ? { width: 1200, height: 630 } : { width: 1800, height: 1480 };
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const content = type === 'social' ? [figures[0], figures.at(-1)].join('') : figures.join('');
      await page.setContent(`<!doctype html><html><head><style>
        *{box-sizing:border-box}body{margin:0;background:#0b1020;color:#f6f8fc;font-family:'Avenir Next',Avenir,Arial,sans-serif;padding:${type === 'social' ? 28 : 36}px}
        header{display:flex;justify-content:space-between;align-items:center;color:#a4b2c8;font-size:${type === 'social' ? 14 : 20}px;margin-bottom:16px}header strong{color:#efc16e}h1{font-size:${type === 'social' ? 38 : 48}px;letter-spacing:-.04em;line-height:1.1;margin:0 0 20px;font-weight:650}
        .frames{display:grid;grid-template-columns:1fr 1fr;gap:${type === 'social' ? 20 : 24}px}figure{margin:0;min-width:0}figcaption{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}figcaption strong{font-size:${type === 'social' ? 17 : 22}px}figcaption span{color:#a4b2c8;font-size:${type === 'social' ? 12 : 16}px}img{display:block;width:100%;height:auto;border:1px solid #2a364c}footer{margin-top:18px;color:#a4b2c8;font-size:${type === 'social' ? 14 : 18}px;display:flex;justify-content:space-between;gap:20px}.accent{color:#64dce6}
      </style></head><body><header><strong>Crunchy Bananas</strong><span>Before / After · four recorded revisions</span></header><h1>${escape(story.title)}</h1><div class="frames">${content}</div><footer><span>${type === 'social' ? 'Original → Claude Fable 5 → deployed baseline → Astra' : escape(story.share.captureLabel || '1440 × 900 captures · same input · pinned source commits')}</span><span class="accent">${type === 'social' ? 'Real screens. Full history.' : 'Review build · ' + escape(story.slug)}</span></footer></body></html>`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
      const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
      if (!fits) throw new Error(`${slug}/${type}: share layout overflows its canvas`);
      await page.screenshot({ path: resolve(destination, type === 'social' ? 'social.jpg' : 'montage.png'), type: type === 'social' ? 'jpeg' : 'png', ...(type === 'social' ? { quality: 94 } : {}) });
      await page.close();
    }
    console.log(`${slug}: 1200×630 social card and 1800×1480 four-revision montage.`);
  }
} finally { await browser.close(); }
